import type { Person } from "@/db/schema";

// Pure, DB-free index over ONE tree's data (the single getTree preload). Resolvers
// read only from here — no per-field queries — so there is no N+1 to fix (DataLoader
// is deferred to a learning TODO) and a token for tree A can never reach tree B's rows.
//
//   getTree(treeId) ──► GraphTree ──► buildIndex ──► TreeIndex (maps) ──► resolvers
//
// getTree's result is structurally assignable to GraphTree (its rows carry extra
// columns we ignore here).

export interface GraphTree {
  name: string;
  persons: Person[];
  couples: { id: string; personA: string; personB: string }[];
  parentChild: { parentId: string; childId: string }[];
}

export interface CoupleRef {
  id: string;
  personA: string;
  personB: string;
}

export interface TreeIndex {
  personById: Map<string, Person>;
  childrenByParent: Map<string, string[]>;
  parentsByChild: Map<string, string[]>;
  couplesByPerson: Map<string, string[]>;
  coupleById: Map<string, CoupleRef>;
}

function push(map: Map<string, string[]>, key: string, value: string) {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}

export function buildIndex(tree: GraphTree): TreeIndex {
  const personById = new Map(tree.persons.map((p) => [p.id, p]));
  const childrenByParent = new Map<string, string[]>();
  const parentsByChild = new Map<string, string[]>();
  const couplesByPerson = new Map<string, string[]>();
  const coupleById = new Map<string, CoupleRef>();

  for (const e of tree.parentChild) {
    push(childrenByParent, e.parentId, e.childId);
    push(parentsByChild, e.childId, e.parentId);
  }
  for (const c of tree.couples) {
    coupleById.set(c.id, { id: c.id, personA: c.personA, personB: c.personB });
    push(couplesByPerson, c.personA, c.id);
    push(couplesByPerson, c.personB, c.id);
  }
  return { personById, childrenByParent, parentsByChild, couplesByPerson, coupleById };
}
