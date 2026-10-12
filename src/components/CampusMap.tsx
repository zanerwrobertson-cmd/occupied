/**
 * CAMPUS MAP — the "Map" view on the home screen.
 *
 * WHAT YOU SEE
 *   - A legend strip at the top (Quiet / Moderate / Busy / Very Busy / Closed or No data).
 *   - A real map of campus: roads, paths, grass, the Thames, and every building outline, drawn
 *     from OpenStreetMap data stored in src/data/campusMap.ts.
 *   - The app's buildings filled in their busyness colour, each with a round pin (bars glyph).
 *   - Zoom buttons (+, −, ⤢ "show all") and an "© OpenStreetMap contributors" credit.
 *   - Tap a building → a summary card at the bottom with "View details".
 *
 * HOW IT WORKS (the key idea: a "camera")
 *   The map data is in metres (x → east, y → south) from the north-west corner of the area.
 *   A Camera says which part of that is on screen: `x, y` = the map point at the screen's
 *   top-left corner, `scale` = how many screen pixels one metre takes up.
 *     - Panning changes x and y.     - Zooming changes scale.
 *   The SVG's `viewBox` is set from the camera, so the whole map redraws in the new position.
 *   Pins are normal Views placed on top, at: screenX = (mapX − cam.x) × cam.scale.
 *
 * GESTURES
 *   - Drag with one finger / the mouse to pan.
 *   - Pinch with two fingers to zoom (around the point between your fingers).
 *   - On the web, the scroll wheel / trackpad zooms around the cursor.
 *   All of this uses React Native's built-in PanResponder, so no extra library is needed and it
 *   works the same on iOS, Android and the web.
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CAMPUS_MAP } from '@/data/campusMap';
import type { Building, Level } from '@/data/types';
import { font, useTheme, type Theme } from '@/theme/theme';

import { ChevronRightIcon } from './Icons';
import { LevelBadge, LevelBars, TrendLabel } from './Level';

// --- Camera maths (plain functions, no React) ----------------------------------------------
/** Viewport: top-left corner in map metres, and screen pixels per metre. */
type Camera = { x: number; y: number; scale: number };

/** Metres of breathing room around the app's buildings when fitting the map to the screen. */
const FIT_PAD_M = 70;
/** Most zoomed-in allowed: 6 px per metre (a 10 m building is 60 px wide). */
const MAX_SCALE = 6;
/** Above this zoom (px per metre) pins also show their short code. */
const CODE_SCALE = 0.9;
/** Approximate height of the summary card, so a selected building isn't hidden behind it. */
const SHEET_H = 160;

/**
 * A camera that fits every app building on a w × h pixel screen.
 * Finds the bounding box of all building centres (plus padding), picks the largest scale that
 * fits both its width and height, then centres it.
 */
function fitCamera(w: number, h: number): Camera {
  const pts = Object.values(CAMPUS_MAP.buildings);
  const minX = Math.min(...pts.map((p) => p.x)) - FIT_PAD_M;
  const maxX = Math.max(...pts.map((p) => p.x)) + FIT_PAD_M;
  const minY = Math.min(...pts.map((p) => p.y)) - FIT_PAD_M;
  const maxY = Math.max(...pts.map((p) => p.y)) + FIT_PAD_M;
  const scale = Math.min(w / (maxX - minX), h / (maxY - minY));
  return { scale, x: (minX + maxX) / 2 - w / 2 / scale, y: (minY + maxY) / 2 - h / 2 / scale };
}

/** Keep zoom in range and at least half the screen over the map. */
function clampCamera(c: Camera, w: number, h: number): Camera {
  // Can't zoom out much beyond "show everything", or in past MAX_SCALE.
  const minScale = fitCamera(w, h).scale * 0.6;
  const scale = Math.min(MAX_SCALE, Math.max(minScale, c.scale));
  // How many metres are visible across and down.
  const vw = w / scale;
  const vh = h / scale;
  // Stop panning once half the screen has gone past the map's edge.
  return {
    scale,
    x: Math.min(CAMPUS_MAP.width - vw / 2, Math.max(-vw / 2, c.x)),
    y: Math.min(CAMPUS_MAP.height - vh / 2, Math.max(-vh / 2, c.y)),
  };
}

/** Zoom by `factor`, keeping the map point under screen pixel (px, py) fixed. */
function zoomAt(c: Camera, factor: number, px: number, py: number, w: number, h: number): Camera {
  const scale = clampCamera({ ...c, scale: c.scale * factor }, w, h).scale;
  // (mx, my) = the map point currently under the finger/cursor…
  const mx = c.x + px / c.scale;
  const my = c.y + py / c.scale;
  // …and we move the camera so that same point is still under it at the new scale.
  return clampCamera({ scale, x: mx - px / scale, y: my - py / scale }, w, h);
}

// --- Gesture handling ------------------------------------------------------------------------
/** Last gesture position: drag offset, or pinch distance and midpoint (dist 0 = not pinching). */
type Gesture = { dx: number; dy: number; dist: number; midX: number; midY: number };
const NO_GESTURE: Gesture = { dx: 0, dy: 0, dist: 0, midX: 0, midY: 0 };

/** Map size, its window origin (for pinch midpoints), camera, and the gesture in progress. */
type MapView = { w: number; h: number; ox: number; oy: number; cam: Camera | null; g: Gesture };
const EMPTY_VIEW: MapView = { w: 0, h: 0, ox: 0, oy: 0, cam: null, g: NO_GESTURE };

/** Apply one pan-responder move: one finger (or mouse) drags, two fingers pinch-zoom and drag. */
function gestureStep(v: MapView, touches: { x: number; y: number }[], dx: number, dy: number): MapView {
  if (!v.cam) return v;
  const last = v.g; // where the gesture was on the previous move event
  // TWO FINGERS → pinch zoom (+ drag by moving both fingers)
  if (touches.length >= 2) {
    const [a, b] = touches;
    // Distance between the fingers, and the midpoint (relative to the map's top-left).
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const midX = (a.x + b.x) / 2 - v.ox;
    const midY = (a.y + b.y) / 2 - v.oy;
    const g = { dx, dy, dist, midX, midY };
    // First two-finger event: just remember the starting distance.
    if (last.dist === 0) return { ...v, g };
    // Fingers moved apart by 10% → zoom in 10%, around the midpoint. Then follow the midpoint.
    const z = zoomAt(v.cam, dist / last.dist, midX, midY, v.w, v.h);
    const cam = clampCamera({ ...z, x: z.x - (midX - last.midX) / z.scale, y: z.y - (midY - last.midY) / z.scale }, v.w, v.h);
    return { ...v, cam, g };
  }
  // ONE FINGER / MOUSE → drag. dx, dy = total movement since the gesture started, so the
  // change since the last event is (dx − last.dx). Dragging right moves the map right, which
  // means the camera moves left: hence the minus sign.
  // Coming out of a pinch, restart the drag from here so the map doesn't jump.
  const ddx = last.dist > 0 ? 0 : dx - last.dx;
  const ddy = last.dist > 0 ? 0 : dy - last.dy;
  const cam = clampCamera({ ...v.cam, x: v.cam.x - ddx / v.cam.scale, y: v.cam.y - ddy / v.cam.scale }, v.w, v.h);
  return { ...v, cam, g: { ...NO_GESTURE, dx, dy } };
}

// --- The component --------------------------------------------------------------------------
/**
 * Campus map drawn from OpenStreetMap outlines (see scripts/build-campus-map.mjs).
 * Drag to pan, pinch / scroll wheel / buttons to zoom; tap a building for its summary.
 */
export function CampusMap({
  buildings,
  muted,
  onOpen,
}: {
  buildings: Building[];
  /** Grey out levels when the data is stale */
  muted?: boolean;
  onOpen: (id: string) => void;
}) {
  const { t, level, neutral, display, scheme } = useTheme();
  // Everything about the camera and gestures lives in one state object (see MapView above).
  // Updating it only through setView(v => …) keeps the gesture code free of "refs", which the
  // React Compiler lint rules require.
  const [view, setView] = useState<MapView>(EMPTY_VIEW);
  // Id of the tapped building (shows the summary card), or null.
  const [selected, setSelected] = useState<string | null>(null);
  // A handle on the map's View, to measure it and (on web) attach the wheel listener.
  const rootRef = useRef<View>(null);
  const sel = buildings.find((b) => b.id === selected);
  const { cam, w, h } = view;

  // Runs when the map area gets its size (and again if the window is resized). First time:
  // fit all buildings on screen. Later: keep the current view but make sure it's still valid.
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setView((v) => ({
      ...v,
      w: width,
      h: height,
      cam: v.cam ? clampCamera(v.cam, width, height) : fitCamera(width, height),
    }));
    // Where the map sits in the window — pinch positions arrive in window coordinates.
    rootRef.current?.measureInWindow((ox, oy) => setView((v) => ({ ...v, ox, oy })));
  };

  // The gesture handler. Created once (useMemo with []) and attached to the map View below.
  const pan = useMemo(
    () =>
      PanResponder.create({
        // Take over the touch only once it moves more than 4 px (or uses two fingers), so a
        // simple tap still reaches the building pins underneath.
        onMoveShouldSetPanResponderCapture: (_, g) =>
          g.numberActiveTouches > 1 || Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
        // Don't let anything else (e.g. a scroll view) steal the gesture mid-drag.
        onPanResponderTerminationRequest: () => false,
        // New gesture: forget the previous one's positions.
        onPanResponderGrant: () => setView((v) => ({ ...v, g: NO_GESTURE })),
        onPanResponderMove: (e, g) => {
          // Copy what we need now; the event object may be reused.
          const touches = e.nativeEvent.touches.map((p) => ({ x: p.pageX, y: p.pageY }));
          const { dx, dy } = g;
          setView((v) => gestureStep(v, touches, dx, dy));
        },
      }),
    [],
  );

  // Web: scroll wheel / trackpad zooms the map instead of scrolling the page.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = rootRef.current as unknown as WebNode | null;
    if (!node?.addEventListener) return;
    node.style.touchAction = 'none';
    const onWheel = (e: WebWheel) => {
      e.preventDefault();
      const r = node.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      setView((v) => (v.cam ? { ...v, cam: zoomAt(v.cam, factor, px, py, v.w, v.h) } : v));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  // +/− buttons: zoom around the centre of the screen.
  const zoomBy = (factor: number) =>
    setView((v) => (v.cam ? { ...v, cam: zoomAt(v.cam, factor, v.w / 2, v.h / 2, v.w, v.h) } : v));

  // Tap on a building (its pin, or its outline on iOS/Android).
  const select = (id: string) => {
    setSelected(id);
    // Keep the building on screen and clear of the summary card.
    const p = CAMPUS_MAP.buildings[id];
    setView((v) => {
      if (!v.cam || !p) return v;
      const m = 48; // keep at least 48 px from the edges
      // Where the building is on screen right now…
      const sx = (p.x - v.cam.x) * v.cam.scale;
      const sy = (p.y - v.cam.y) * v.cam.scale;
      // …and how far to slide the map so it's inside the safe area (above the card).
      const shiftX = sx < m ? sx - m : sx > v.w - m ? sx - (v.w - m) : 0;
      const shiftY = sy < m ? sy - m : sy > v.h - SHEET_H - m ? sy - (v.h - SHEET_H - m) : 0;
      if (!shiftX && !shiftY) return v;
      const cam = { ...v.cam, x: v.cam.x + shiftX / v.cam.scale, y: v.cam.y + shiftY / v.cam.scale };
      return { ...v, cam: clampCamera(cam, v.w, v.h) };
    });
  };

  // Building codes ("WEL", "UCC") only once zoomed in enough that they don't overlap.
  const showCodes = !!cam && cam.scale >= CODE_SCALE;
  const size = { w, h };

  return (
    <View style={[styles.root, { backgroundColor: t.bg, borderTopColor: t.border }]}>
      {/* ===== Legend strip (scrolls sideways on narrow phones) ===== */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.legendScroll}
        contentContainerStyle={styles.legend}
      >
        {([0, 1, 2, 3] as Level[]).map((l) => {
          const s = level(l);
          return (
            <View key={l} style={[styles.legendChip, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={[styles.legendDot, { backgroundColor: s.solid }]}>
                <LevelBars level={l} color={s.pinFg} scale={0.55} />
              </View>
              <Text style={[styles.legendText, { color: t.text }]}>{s.label}</Text>
            </View>
          );
        })}
        {/* The grey chip: all bars faint = no level */}
        <View style={[styles.legendChip, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={[styles.legendDot, { backgroundColor: neutral.solid }]}>
            <LevelBars color={neutral.pinFg} scale={0.55} />
          </View>
          <Text style={[styles.legendText, { color: t.text }]}>Closed / No data</Text>
        </View>
      </ScrollView>

      {/* ===== The map area. {...pan.panHandlers} attaches the drag/pinch handling. ===== */}
      <View
        ref={rootRef}
        onLayout={onLayout}
        style={[styles.map, { backgroundColor: t.mapLand }]}
        {...pan.panHandlers}
      >
        {/* Wait until we know the size and have a camera before drawing anything. */}
        {cam && size.w > 0 && (
          <>
            {/* --- Layer 1: the SVG drawing. viewBox = "which metres are visible" (from the camera). --- */}
            <Svg
              width={size.w}
              height={size.h}
              viewBox={`${cam.x} ${cam.y} ${size.w / cam.scale} ${size.h / cam.scale}`}
              style={StyleSheet.absoluteFill}
            >
              {/* Roads, grass, river, other buildings — never change, so drawn once (memo). */}
              <Background t={t} />
              {/* The app's buildings, filled with their level colour. */}
              {buildings.map((b) => {
                const shape = CAMPUS_MAP.buildings[b.id];
                if (!shape) return null;
                const on = b.id === selected;
                return (
                  <Path
                    key={b.id}
                    d={shape.d}
                    fill={display(b, muted).solid}
                    fillRule="evenodd"
                    stroke={on ? t.accent : t.surface}
                    strokeWidth={on ? 3 : 1.5}
                    // Keep the outline the same pixel width at every zoom level.
                    vectorEffect="non-scaling-stroke"
                    // react-native-svg can't make paths pressable on web; the pins handle taps there.
                    onPress={Platform.OS === 'web' ? undefined : () => select(b.id)}
                  />
                );
              })}
            </Svg>

            {/* --- Layer 2: round pins on top, one per building, at its centre. --- */}
            {buildings.map((b) => {
              const shape = CAMPUS_MAP.buildings[b.id];
              if (!shape) return null;
              // Map metres → screen pixels.
              const x = (shape.x - cam.x) * cam.scale;
              const y = (shape.y - cam.y) * cam.scale;
              // Skip pins that are off screen.
              if (x < -40 || y < -40 || x > size.w + 40 || y > size.h + 40) return null;
              const s = display(b, muted);
              const on = b.id === selected;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => select(b.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${b.name}, ${s.label}`}
                  hitSlop={6}
                  // Pin is 52 px wide with a 24 px dot: shift so the dot's centre is on the building.
                  style={[styles.pin, { left: x - 26, top: y - 12 }]}
                >
                  <View
                    style={[
                      styles.pinDot,
                      { backgroundColor: s.solid, borderColor: on ? t.accent : t.surface, borderWidth: on ? 3 : 2 },
                    ]}
                  >
                    <LevelBars level={b.status === 'live' ? b.level : undefined} color={s.pinFg} scale={0.7} />
                  </View>
                  {/* Short code under the dot when zoomed in, and always for the selected one. */}
                  {(showCodes || on) && (
                    <Text
                      style={[
                        styles.pinLabel,
                        { backgroundColor: on ? t.accent : t.chipBg, color: on ? t.onAccent : t.chipFg },
                      ]}
                    >
                      {b.short}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </>
        )}

        {/* ===== Zoom buttons (top right) — for people who can't pinch or have no scroll wheel ===== */}
        <View style={styles.controls}>
          {[
            { label: 'Zoom in', text: '+', onPress: () => zoomBy(1.5) },
            { label: 'Zoom out', text: '−', onPress: () => zoomBy(1 / 1.5) },
            { label: 'Show all buildings', text: '⤢', onPress: () => setView((v) => ({ ...v, cam: fitCamera(v.w, v.h) })) },
          ].map((c) => (
            <Pressable
              key={c.label}
              onPress={c.onPress}
              accessibilityRole="button"
              accessibilityLabel={c.label}
              style={({ pressed }) => [
                styles.control,
                { backgroundColor: t.surface, borderColor: t.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.controlText, { color: t.text }]}>{c.text}</Text>
            </Pressable>
          ))}
        </View>

        {/* OpenStreetMap's licence (ODbL) requires this credit to be visible. */}
        <Text style={[styles.attribution, { backgroundColor: t.chipBg, color: t.text2 }]}>
          © OpenStreetMap contributors
        </Text>

        {/* ===== Summary card for the selected building =====
            pointerEvents 'box-none': the empty space around the card lets touches through to the map. */}
        {sel && (
          <View style={[styles.sheetWrap, { pointerEvents: 'box-none' }]}>
            <View
              style={[
                styles.sheet,
                { backgroundColor: t.surface, shadowOpacity: scheme === 'dark' ? 0.5 : 0.18 },
              ]}
            >
              <View style={styles.sheetRow}>
                <View style={styles.sheetText}>
                  <Text style={[styles.sheetName, { color: t.text }]}>{sel.name}</Text>
                  {sel.status === 'live' && <TrendLabel trend={sel.trend} color={t.text2} />}
                </View>
                <LevelBadge rated={sel} muted={muted} />
                <Pressable
                  onPress={() => setSelected(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={8}
                  style={styles.close}
                >
                  <Text style={[styles.closeText, { color: t.text2 }]}>✕</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => onOpen(sel.id)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.sheetBtn, { backgroundColor: t.accent, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={[styles.sheetBtnText, { color: t.onAccent }]}>View details</Text>
                <ChevronRightIcon color={t.onAccent} />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Static OSM layers — memoised so panning only changes the viewBox.
 * Drawn bottom to top: grass, water, river line, footpaths, roads, other buildings.
 * Stroke widths are in metres (roads ≈ 8 m wide), so they get thicker as you zoom in, like a real map.
 */
const Background = memo(function Background({ t }: { t: Theme }) {
  return (
    <>
      <Path d={CAMPUS_MAP.green} fill={t.mapGreen} />
      <Path d={CAMPUS_MAP.water} fill={t.mapRiver} fillRule="evenodd" />
      <Path d={CAMPUS_MAP.river} fill="none" stroke={t.mapRiver} strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={CAMPUS_MAP.paths} fill="none" stroke={t.mapRoad} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
      <Path d={CAMPUS_MAP.roads} fill="none" stroke={t.mapRoad} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={CAMPUS_MAP.otherBuildings} fill={t.mapBuilding} fillRule="evenodd" />
    </>
  );
});

/**
 * The slice of the DOM API used for wheel zoom on web.
 * (On the web, React Native Views are real HTML elements, so we can listen for "wheel" events.
 * These small types describe just the bits we use, so the app doesn't need the full DOM types.)
 */
type WebWheel = { deltaY: number; clientX: number; clientY: number; preventDefault: () => void };
type WebNode = {
  style: { touchAction: string };
  getBoundingClientRect: () => { left: number; top: number };
  addEventListener: (type: 'wheel', fn: (e: WebWheel) => void, opts: { passive: boolean }) => void;
  removeEventListener: (type: 'wheel', fn: (e: WebWheel) => void) => void;
};

// --- Styles ----------------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: { flex: 1, borderTopWidth: 1 },
  legendScroll: { flexGrow: 0 },
  legend: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  legendDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 },
  legendText: { fontFamily: font.bold, fontSize: 12 },
  map: { flex: 1, overflow: 'hidden' }, // hidden: pins near the edge don't spill over the legend
  // position: 'absolute' + left/top = place the pin at exact pixel coordinates.
  pin: { position: 'absolute', width: 52, alignItems: 'center', gap: 2 },
  pinDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 5,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  pinLabel: {
    fontFamily: font.extrabold,
    fontSize: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  controls: { position: 'absolute', top: 10, right: 10, gap: 6 },
  control: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlText: { fontFamily: font.bold, fontSize: 20, lineHeight: 22 },
  attribution: {
    position: 'absolute',
    top: 10,
    left: 10,
    fontFamily: font.medium,
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  sheetWrap: { position: 'absolute', left: 12, right: 12, bottom: 14, alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 480,
    padding: 16,
    borderRadius: 20,
    gap: 12,
    shadowColor: '#000',
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sheetText: { flex: 1, minWidth: 0, gap: 4 },
  sheetName: { fontFamily: font.extrabold, fontSize: 17, lineHeight: 21 },
  close: { width: 28, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: font.bold, fontSize: 16 },
  sheetBtn: { height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  sheetBtnText: { fontFamily: font.bold, fontSize: 16 },
});
