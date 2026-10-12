/**
 * SEARCH — decides whether a building matches what the user typed in the search box.
 *
 * A building matches if the search text appears in any of: its name, its short code
 * ("WEL"), its aliases ("gym", "library"…), or the name of one of its floors or areas
 * ("spoke" finds the UCC because "The Spoke" is one of its areas).
 */
import type { Building } from '@/data/types';

/** Lowercase and drop everything but letters and digits, so "D.B. Weldon" matches "db weldon". */
export function normalize(s: string): string {
  // [^a-z0-9]+ means "one or more characters that are NOT a letter or digit"; replace with nothing.
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Matches name, short code, aliases, and floor or sub-area names. `q` must already be normalized. */
export function matchesQuery(b: Building, q: string): boolean {
  if (!q) return true; // empty search → show everything
  // Everything we search through, in one list. `?? []` = use an empty list if it's missing.
  const fields = [
    b.name,
    b.short,
    ...(b.aliases ?? []),
    ...(b.floors ?? []).map((z) => z.name),
    ...(b.areas ?? []).map((z) => z.name),
  ];
  return fields.some((f) => normalize(f).includes(q));
}
