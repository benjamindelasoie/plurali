import type { Person } from "@/db/schema";
import { freshness } from "@/lib/flow";
import type { GraphTree, TreeIndex, CoupleRef } from "./treeIndex";

// All resolvers are PURE over the preloaded tree + index (see treeIndex.ts).
// No resolver touches the database. person(id) returns null for an id outside
// the authorized tree (never an auth-shaped error — that would leak which ids
// exist globally via error shape/timing).

// type alias (not interface) so it satisfies Yoga's `Record<string, unknown>`
// context constraint — interfaces aren't assignable to index-signature types.
export type GraphQLContext = {
  treeId: string;
  tree: GraphTree;
  index: TreeIndex;
};

const lookup = (index: TreeIndex, ids: string[] | undefined): Person[] =>
  (ids ?? []).map((id) => index.personById.get(id)).filter((p): p is Person => p != null);

export const resolvers = {
  Query: {
    tree: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.tree,
    person: (_: unknown, args: { id: string }, ctx: GraphQLContext): Person | null =>
      ctx.index.personById.get(args.id) ?? null,
  },

  Tree: {
    name: (t: GraphTree) => t.name,
    people: (t: GraphTree) => t.persons,
    couples: (t: GraphTree): CoupleRef[] =>
      t.couples.map((c) => ({ id: c.id, personA: c.personA, personB: c.personB })),
    parentChild: (t: GraphTree) => t.parentChild,
  },

  Person: {
    updatedAt: (p: Person) => new Date(p.updatedAt).toISOString(),
    fresh: (p: Person) => freshness(p.updatedAt).fresh,
    parents: (p: Person, _: unknown, ctx: GraphQLContext) =>
      lookup(ctx.index, ctx.index.parentsByChild.get(p.id)),
    children: (p: Person, _: unknown, ctx: GraphQLContext) =>
      lookup(ctx.index, ctx.index.childrenByParent.get(p.id)),
    couples: (p: Person, _: unknown, ctx: GraphQLContext): CoupleRef[] =>
      (ctx.index.couplesByPerson.get(p.id) ?? [])
        .map((id) => ctx.index.coupleById.get(id))
        .filter((c): c is CoupleRef => c != null),
  },

  Couple: {
    personA: (c: CoupleRef, _: unknown, ctx: GraphQLContext) => ctx.index.personById.get(c.personA),
    personB: (c: CoupleRef, _: unknown, ctx: GraphQLContext) => ctx.index.personById.get(c.personB),
    children: (c: CoupleRef, _: unknown, ctx: GraphQLContext): Person[] => {
      // children whose parents include BOTH partners = children of this union
      const aKids = new Set(ctx.index.childrenByParent.get(c.personA) ?? []);
      const shared = (ctx.index.childrenByParent.get(c.personB) ?? []).filter((id) => aKids.has(id));
      return lookup(ctx.index, shared);
    },
  },

  ParentChildEdge: {
    parentId: (e: { parentId: string }) => e.parentId,
    childId: (e: { childId: string }) => e.childId,
  },
};
