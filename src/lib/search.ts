import type { Building } from '@/data/types';

/** Lowercase and drop everything but letters and digits, so "D.B. Weldon" matches "db weldon". */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Matches name, short code, aliases, and floor or sub-area names. `q` must already be normalized. */
export function matchesQuery(b: Building, q: string): boolean {
  if (!q) return true;
  const fields = [
    b.name,
    b.short,
    ...(b.aliases ?? []),
    ...(b.floors ?? []).map((z) => z.name),
    ...(b.areas ?? []).map((z) => z.name),
  ];
  return fields.some((f) => normalize(f).includes(q));
}
