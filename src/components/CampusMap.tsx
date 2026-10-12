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

/** Viewport: top-left corner in map metres, and screen pixels per metre. */
type Camera = { x: number; y: number; scale: number };

/** Metres of breathing room around the app's buildings when fitting the map to the screen. */
const FIT_PAD_M = 70;
const MAX_SCALE = 6;
/** Above this zoom (px per metre) pins also show their short code. */
const CODE_SCALE = 0.9;
const SHEET_H = 160;

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
  const minScale = fitCamera(w, h).scale * 0.6;
  const scale = Math.min(MAX_SCALE, Math.max(minScale, c.scale));
  const vw = w / scale;
  const vh = h / scale;
  return {
    scale,
    x: Math.min(CAMPUS_MAP.width - vw / 2, Math.max(-vw / 2, c.x)),
    y: Math.min(CAMPUS_MAP.height - vh / 2, Math.max(-vh / 2, c.y)),
  };
}

/** Zoom by `factor`, keeping the map point under screen pixel (px, py) fixed. */
function zoomAt(c: Camera, factor: number, px: number, py: number, w: number, h: number): Camera {
  const scale = clampCamera({ ...c, scale: c.scale * factor }, w, h).scale;
  const mx = c.x + px / c.scale;
  const my = c.y + py / c.scale;
  return clampCamera({ scale, x: mx - px / scale, y: my - py / scale }, w, h);
}

/** Last gesture position: drag offset, or pinch distance and midpoint (dist 0 = not pinching). */
type Gesture = { dx: number; dy: number; dist: number; midX: number; midY: number };
const NO_GESTURE: Gesture = { dx: 0, dy: 0, dist: 0, midX: 0, midY: 0 };

/** Map size, its window origin (for pinch midpoints), camera, and the gesture in progress. */
type MapView = { w: number; h: number; ox: number; oy: number; cam: Camera | null; g: Gesture };
const EMPTY_VIEW: MapView = { w: 0, h: 0, ox: 0, oy: 0, cam: null, g: NO_GESTURE };

/** Apply one pan-responder move: one finger (or mouse) drags, two fingers pinch-zoom and drag. */
function gestureStep(v: MapView, touches: { x: number; y: number }[], dx: number, dy: number): MapView {
  if (!v.cam) return v;
  const last = v.g;
  if (touches.length >= 2) {
    const [a, b] = touches;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const midX = (a.x + b.x) / 2 - v.ox;
    const midY = (a.y + b.y) / 2 - v.oy;
    const g = { dx, dy, dist, midX, midY };
    if (last.dist === 0) return { ...v, g };
    const z = zoomAt(v.cam, dist / last.dist, midX, midY, v.w, v.h);
    const cam = clampCamera({ ...z, x: z.x - (midX - last.midX) / z.scale, y: z.y - (midY - last.midY) / z.scale }, v.w, v.h);
    return { ...v, cam, g };
  }
  // Coming out of a pinch, restart the drag from here so the map doesn't jump.
  const ddx = last.dist > 0 ? 0 : dx - last.dx;
  const ddy = last.dist > 0 ? 0 : dy - last.dy;
  const cam = clampCamera({ ...v.cam, x: v.cam.x - ddx / v.cam.scale, y: v.cam.y - ddy / v.cam.scale }, v.w, v.h);
  return { ...v, cam, g: { ...NO_GESTURE, dx, dy } };
}

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
  const [view, setView] = useState<MapView>(EMPTY_VIEW);
  const [selected, setSelected] = useState<string | null>(null);
  const rootRef = useRef<View>(null);
  const sel = buildings.find((b) => b.id === selected);
  const { cam, w, h } = view;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setView((v) => ({
      ...v,
      w: width,
      h: height,
      cam: v.cam ? clampCamera(v.cam, width, height) : fitCamera(width, height),
    }));
    rootRef.current?.measureInWindow((ox, oy) => setView((v) => ({ ...v, ox, oy })));
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) =>
          g.numberActiveTouches > 1 || Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
        onPanResponderTerminationRequest: () => false,
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

  const zoomBy = (factor: number) =>
    setView((v) => (v.cam ? { ...v, cam: zoomAt(v.cam, factor, v.w / 2, v.h / 2, v.w, v.h) } : v));

  const select = (id: string) => {
    setSelected(id);
    // Keep the building on screen and clear of the summary card.
    const p = CAMPUS_MAP.buildings[id];
    setView((v) => {
      if (!v.cam || !p) return v;
      const m = 48;
      const sx = (p.x - v.cam.x) * v.cam.scale;
      const sy = (p.y - v.cam.y) * v.cam.scale;
      const shiftX = sx < m ? sx - m : sx > v.w - m ? sx - (v.w - m) : 0;
      const shiftY = sy < m ? sy - m : sy > v.h - SHEET_H - m ? sy - (v.h - SHEET_H - m) : 0;
      if (!shiftX && !shiftY) return v;
      const cam = { ...v.cam, x: v.cam.x + shiftX / v.cam.scale, y: v.cam.y + shiftY / v.cam.scale };
      return { ...v, cam: clampCamera(cam, v.w, v.h) };
    });
  };

  const showCodes = !!cam && cam.scale >= CODE_SCALE;
  const size = { w, h };

  return (
    <View style={[styles.root, { backgroundColor: t.bg, borderTopColor: t.border }]}>
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
        <View style={[styles.legendChip, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={[styles.legendDot, { backgroundColor: neutral.solid }]}>
            <LevelBars color={neutral.pinFg} scale={0.55} />
          </View>
          <Text style={[styles.legendText, { color: t.text }]}>Closed / No data</Text>
        </View>
      </ScrollView>

      <View
        ref={rootRef}
        onLayout={onLayout}
        style={[styles.map, { backgroundColor: t.mapLand }]}
        {...pan.panHandlers}
      >
        {cam && size.w > 0 && (
          <>
            <Svg
              width={size.w}
              height={size.h}
              viewBox={`${cam.x} ${cam.y} ${size.w / cam.scale} ${size.h / cam.scale}`}
              style={StyleSheet.absoluteFill}
            >
              <Background t={t} />
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
                    vectorEffect="non-scaling-stroke"
                    // react-native-svg can't make paths pressable on web; the pins handle taps there.
                    onPress={Platform.OS === 'web' ? undefined : () => select(b.id)}
                  />
                );
              })}
            </Svg>

            {buildings.map((b) => {
              const shape = CAMPUS_MAP.buildings[b.id];
              if (!shape) return null;
              const x = (shape.x - cam.x) * cam.scale;
              const y = (shape.y - cam.y) * cam.scale;
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

        <Text style={[styles.attribution, { backgroundColor: t.chipBg, color: t.text2 }]}>
          © OpenStreetMap contributors
        </Text>

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

/** Static OSM layers — memoised so panning only changes the viewBox. */
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

/** The slice of the DOM API used for wheel zoom on web. */
type WebWheel = { deltaY: number; clientX: number; clientY: number; preventDefault: () => void };
type WebNode = {
  style: { touchAction: string };
  getBoundingClientRect: () => { left: number; top: number };
  addEventListener: (type: 'wheel', fn: (e: WebWheel) => void, opts: { passive: boolean }) => void;
  removeEventListener: (type: 'wheel', fn: (e: WebWheel) => void) => void;
};

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
  map: { flex: 1, overflow: 'hidden' },
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
