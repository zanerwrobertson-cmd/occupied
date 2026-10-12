/**
 * Builds src/data/campusMap.ts from OpenStreetMap.
 *
 *   node scripts/build-campus-map.mjs
 *
 * Downloads building outlines, roads, paths, green space and water around Western's main
 * campus from the Overpass API, projects them to metres, simplifies them, and writes them
 * as SVG path strings. Run it again to pick up OSM edits or after adding a building below.
 *
 * Map data © OpenStreetMap contributors, available under the Open Database License (ODbL).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** App building id → OSM element ("w" way / "r" relation + id). */
const OSM_IDS = {
  weldon: 'w118764108',
  taylor: 'w141710485',
  rec: 'w310132539',
  ucc: 'w141710486',
  ssc: 'w141710484',
  nsc: 'w116779542',
  pab: 'w142286122',
  mc: 'w118764099',
  uc: 'w118764092',
  tc: 'w116779543',
  th: 'w118764095',
  ivey: 'r7379137',
  ahb: 'w1203774692',
  fims: 'w558927474',
  hsb: 'w126668543',
  msb: 'w141710482',
  bgs: 'r7932251',
  chem: 'r7932252',
  seb: 'w118764110',
  teb: 'w118764098',
  aceb: 'w626520018',
  stevenson: 'w118764109',
  ncb: 'w142286116',
};

/** Context drawn this far beyond the app's buildings, in metres. */
const MARGIN_M = 220;
/** Simplification tolerance, in metres. */
const TOLERANCE_M = 0.8;

/** Public Overpass servers, tried in turn — they are often busy. */
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'campusMap.ts');

async function overpass(query) {
  let last;
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = OVERPASS[attempt % OVERPASS.length];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'occupied-campus-map/1.0' },
        body: 'data=' + encodeURIComponent(`[out:json][timeout:90];${query}`),
      });
      if (res.ok) return (await res.json()).elements;
      last = new Error(`${url} ${res.status}`);
    } catch (e) {
      last = e;
    }
    console.warn(`Overpass busy (${last.message}), retrying…`);
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
  }
  throw last;
}

// ---------- geometry helpers ----------

/** Join a relation's outer/inner member ways into closed rings. */
function stitch(ways) {
  const rings = [];
  const open = ways.map((w) => [...w]);
  while (open.length) {
    let ring = open.shift();
    let grew = true;
    while (grew && !same(ring[0], ring[ring.length - 1])) {
      grew = false;
      for (let i = 0; i < open.length; i++) {
        const w = open[i];
        const end = ring[ring.length - 1];
        if (same(end, w[0])) ring = ring.concat(w.slice(1));
        else if (same(end, w[w.length - 1])) ring = ring.concat([...w].reverse().slice(1));
        else continue;
        open.splice(i, 1);
        grew = true;
        break;
      }
    }
    rings.push(ring);
  }
  return rings;
}

const same = (a, b) => a.lat === b.lat && a.lon === b.lon;

/** Rings (lat/lon) for a way or multipolygon relation. */
function rings(el) {
  if (el.type === 'way') return el.geometry ? [el.geometry] : [];
  const members = (el.members ?? []).filter((m) => m.type === 'way' && m.geometry);
  return stitch(members.map((m) => m.geometry));
}

/** Douglas–Peucker on [x, y] points. */
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let max = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > max) [max, idx] = [d, i];
    }
    if (max > tol) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function area(pts) {
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) s += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  return s / 2;
}

function centroid(pts) {
  const a = area(pts);
  if (Math.abs(a) < 1e-6) return pts[0];
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const f = pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
    cx += (pts[i][0] + pts[i + 1][0]) * f;
    cy += (pts[i][1] + pts[i + 1][1]) * f;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

const r1 = (n) => Math.round(n * 10) / 10;

// ---------- main ----------

const wanted = Object.values(OSM_IDS);
const byType = (t) => wanted.filter((k) => k[0] === t).map((k) => k.slice(1));
const targets = await overpass(
  `(way(id:${byType('w').join(',')});relation(id:${byType('r').join(',')}););out geom;`,
);
const byKey = new Map(targets.map((e) => [e.type[0] + e.id, e]));
for (const [id, key] of Object.entries(OSM_IDS)) if (!byKey.has(key)) throw new Error(`Missing OSM ${key} for ${id}`);

// Bounding box of the app's buildings, plus margin.
const all = targets.flatMap((e) => rings(e).flat());
const lat0 = (Math.min(...all.map((p) => p.lat)) + Math.max(...all.map((p) => p.lat))) / 2;
const mPerLat = 111_320;
const mPerLon = 111_320 * Math.cos((lat0 * Math.PI) / 180);
const dLat = MARGIN_M / mPerLat;
const dLon = MARGIN_M / mPerLon;
const south = Math.min(...all.map((p) => p.lat)) - dLat;
const north = Math.max(...all.map((p) => p.lat)) + dLat;
const west = Math.min(...all.map((p) => p.lon)) - dLon;
const east = Math.max(...all.map((p) => p.lon)) + dLon;
const bbox = `(${south},${west},${north},${east})`;

const project = (p) => [(p.lon - west) * mPerLon, (north - p.lat) * mPerLat];
const width = Math.round((east - west) * mPerLon);
const height = Math.round((north - south) * mPerLat);

/** Simplify a closed ring by splitting it at the point farthest from its start. */
function simplifyRing(pts, tol) {
  let k = 0;
  let far = -1;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
    if (d > far) [far, k] = [d, i];
  }
  return simplify(pts.slice(0, k + 1), tol).concat(simplify(pts.slice(k), tol).slice(1));
}

/** Path data for closed rings, simplified. */
function polyPath(rs) {
  return rs
    .map((r) => simplifyRing(r.map(project), TOLERANCE_M))
    .filter((r) => r.length >= 4)
    .map((r) => 'M' + r.slice(0, -1).map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L') + 'Z')
    .join('');
}

/** Path data for open lines, simplified. */
function linePath(geom) {
  const pts = simplify(geom.map(project), TOLERANCE_M);
  return pts.length < 2 ? '' : 'M' + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L');
}

const context = await overpass(
  `(
    way["building"]${bbox};relation["building"]${bbox};
    way["highway"]${bbox};
    way["leisure"~"^(park|pitch|garden|common)$"]${bbox};relation["leisure"~"^(park|pitch|garden)$"]${bbox};
    way["landuse"~"^(grass|recreation_ground|forest|meadow)$"]${bbox};relation["landuse"~"^(grass|forest)$"]${bbox};
    way["natural"~"^(wood|water|scrub|grassland)$"]${bbox};relation["natural"~"^(wood|water)$"]${bbox};
    way["waterway"="river"]${bbox};
  );out geom;`,
);

const ROADS = /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)(_link)?$/;
const PATHS = /^(footway|path|pedestrian|cycleway|steps)$/;
const layers = { green: [], water: [], river: [], roads: [], paths: [], buildings: [] };

for (const el of context) {
  const key = el.type[0] + el.id;
  const tg = el.tags ?? {};
  if (tg.building) {
    if (!wanted.includes(key)) layers.buildings.push(polyPath(rings(el)));
  } else if (tg.highway && el.type === 'way') {
    if (tg.area === 'yes') continue;
    if (ROADS.test(tg.highway)) layers.roads.push(linePath(el.geometry));
    else if (PATHS.test(tg.highway) && tg.footway !== 'sidewalk') layers.paths.push(linePath(el.geometry));
  } else if (tg.waterway === 'river' && el.type === 'way') {
    layers.river.push(linePath(el.geometry));
  } else if (tg.natural === 'water') {
    layers.water.push(polyPath(rings(el)));
  } else {
    layers.green.push(polyPath(rings(el)));
  }
}

const buildings = {};
for (const [id, key] of Object.entries(OSM_IDS)) {
  const rs = rings(byKey.get(key));
  const biggest = rs.map((r) => r.map(project)).sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))[0];
  const [cx, cy] = centroid(biggest);
  buildings[id] = { d: polyPath(rs), x: r1(cx), y: r1(cy) };
}

const join_ = (arr) => JSON.stringify(arr.filter(Boolean).join(''));
const src = `// Generated by scripts/build-campus-map.mjs — do not edit by hand.
// Map data © OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright).
// Units are metres from the north-west corner; y points south.

export type CampusShape = { d: string; x: number; y: number };

export const CAMPUS_MAP = {
  width: ${width},
  height: ${height},
  /** Outline and label anchor for each app building, keyed by building id */
  buildings: ${JSON.stringify(buildings, null, 2).replace(/\n/g, '\n  ')} as Record<string, CampusShape>,
  /** Background layers, one path each */
  green: ${join_(layers.green)},
  water: ${join_(layers.water)},
  river: ${join_(layers.river)},
  roads: ${join_(layers.roads)},
  paths: ${join_(layers.paths)},
  otherBuildings: ${join_(layers.buildings)},
};
`;
writeFileSync(OUT, src);
console.log(`Wrote ${OUT}: ${width}×${height} m, ${(src.length / 1024).toFixed(0)} KB`);
console.log(Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, v.length])));
