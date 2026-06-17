// Pure, accent-insensitive name matcher for the open-link "find yourself" search.
//
// The audience spans non-tech-fluent older relatives who may not reproduce the
// owner's exact spelling (Müller/Mueller, accented vs. not). We normalize both the
// query and each name to NFD and strip combining marks, then do a case-insensitive
// substring match — enough at family scale (a few hundred people, in-memory). No
// fuzzy/Levenshtein in V0 (a possible follow-up).
//
// Kept decoupled from flow.ts (accepts any `{ name }` shape) so plan 010's
// "mint anchored link for whom?" picker can reuse the same matcher.

export interface Named {
  name: string;
}

/** Lowercase + strip diacritics (NFD then drop combining marks). */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * People whose (accent-folded) name contains the (accent-folded) query as a
 * substring. An empty/whitespace-only query returns [] — no query, no results.
 */
export function matchPersons<T extends Named>(persons: T[], query: string): T[] {
  const q = normalize(query);
  if (!q) return [];
  return persons.filter((p) => normalize(p.name).includes(q));
}
