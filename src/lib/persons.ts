import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { trees, persons, couples, parentChild } from "@/db/schema";
import { personInput, addRelativeInput, addChildToCoupleInput, connectParentInput } from "./validation";
import type { TreeContext } from "./auth";
import type { PersonInput } from "./validation";

// T4 — person mutations (eng-review). Pure service layer; routes/actions call these
// after requireTreeContext. All writes stamp the contributing link (attribution) and
// bump updatedAt so the drying-ink freshness signal works.

export class MutationError extends Error {}

/** Load a whole tree (name + people + edges) in a few queries (perf review: never N+1). */
export async function getTree(treeId: string) {
  const [meta, people, coupleRows, pcRows] = await Promise.all([
    db.select({ name: trees.name }).from(trees).where(eq(trees.id, treeId)).limit(1),
    db.select().from(persons).where(eq(persons.treeId, treeId)),
    db.select().from(couples).where(eq(couples.treeId, treeId)),
    db.select().from(parentChild).where(eq(parentChild.treeId, treeId)),
  ]);
  return { name: meta[0]?.name ?? "", persons: people, couples: coupleRows, parentChild: pcRows };
}

// Cycle guard (eng-review + design-review): adding parent->child must never make
// someone their own ancestor. A cycle results iff `parentId` is reachable by
// descending from `childId`. Family data is tiny, so walk it in memory.
export async function wouldCreateCycle(treeId: string, parentId: string, childId: string): Promise<boolean> {
  if (parentId === childId) return true;
  const edges = await db
    .select({ p: parentChild.parentId, c: parentChild.childId })
    .from(parentChild)
    .where(eq(parentChild.treeId, treeId));
  const childrenOf = new Map<string, string[]>();
  for (const e of edges) {
    const arr = childrenOf.get(e.p) ?? [];
    arr.push(e.c);
    childrenOf.set(e.p, arr);
  }
  const seen = new Set<string>([childId]);
  const queue: string[] = [childId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of childrenOf.get(cur) ?? []) {
      if (next === parentId) return true; // descending from child reached parent => cycle
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

// Field values for insert/update (NOT including createdByLinkId — handled per-op so
// editing never overwrites the original creator).
function fields(treeId: string, input: PersonInput) {
  return {
    treeId,
    name: input.name,
    birthplace: input.birthplace ?? null,
    birthYear: input.birthYear ?? null,
    birthMonth: input.birthMonth ?? null,
    birthDay: input.birthDay ?? null,
    deathYear: input.deathYear ?? null,
    deathMonth: input.deathMonth ?? null,
    deathDay: input.deathDay ?? null,
    living: input.living,
  };
}

/** Add a standalone person (e.g. the owner adding themselves first). */
export async function addPerson(ctx: TreeContext, rawInput: unknown) {
  const input = personInput.parse(rawInput);
  const [p] = await db
    .insert(persons)
    .values({ ...fields(ctx.treeId, input), createdByLinkId: ctx.linkId })
    .returning();
  return p;
}

/**
 * Add a person and connect them to an existing one. Covers addPartner (relation:
 * "partner") and addChild (relation: "child") and add-parent (relation: "parent").
 * This is what the mobile contribution form posts.
 */
export async function addRelative(ctx: TreeContext, rawInput: unknown) {
  const { person, relationTo, relation } = addRelativeInput.parse(rawInput);
  const [p] = await db
    .insert(persons)
    .values({ ...fields(ctx.treeId, person), createdByLinkId: ctx.linkId })
    .returning();

  if (relationTo && relation) {
    if (relation === "partner") {
      await db.insert(couples).values({
        treeId: ctx.treeId, personA: relationTo, personB: p.id, createdByLinkId: ctx.linkId,
      });
    } else if (relation === "child") {
      // relationTo is the parent; p is the child
      if (await wouldCreateCycle(ctx.treeId, relationTo, p.id)) {
        throw new MutationError("Eso crearía un ciclo en el árbol.");
      }
      await db.insert(parentChild).values({
        treeId: ctx.treeId, parentId: relationTo, childId: p.id, createdByLinkId: ctx.linkId,
      });
    } else if (relation === "parent") {
      // p is the parent; relationTo is the child
      if (await wouldCreateCycle(ctx.treeId, p.id, relationTo)) {
        throw new MutationError("Eso crearía un ciclo en el árbol.");
      }
      await db.insert(parentChild).values({
        treeId: ctx.treeId, parentId: p.id, childId: relationTo, createdByLinkId: ctx.linkId,
      });
    }
  }
  return p;
}

/** Edit a person's facts. Bumps updatedAt (→ drying-ink fresh). Preserves creator. */
export async function editPerson(ctx: TreeContext, personId: string, rawInput: unknown) {
  const input = personInput.parse(rawInput);
  const [p] = await db
    .update(persons)
    .set({ ...fields(ctx.treeId, input), updatedAt: new Date() })
    .where(and(eq(persons.id, personId), eq(persons.treeId, ctx.treeId)))
    .returning();
  if (!p) throw new MutationError("No se encontró la persona.");
  return p;
}

/**
 * Add a NEW child to an existing marriage/couple — both spouses become parents, and
 * the union is explicit (handles remarriage: pick WHICH marriage). Half-siblings fall
 * out naturally because a parent's other children come from their other couples.
 * A brand-new child can't create a cycle, so no guard needed here.
 */
export async function addChildToCouple(ctx: TreeContext, rawInput: unknown) {
  const { coupleId, child } = addChildToCoupleInput.parse(rawInput);
  const [couple] = await db
    .select()
    .from(couples)
    .where(and(eq(couples.id, coupleId), eq(couples.treeId, ctx.treeId)))
    .limit(1);
  if (!couple) throw new MutationError("No se encontró ese matrimonio.");

  const [c] = await db
    .insert(persons)
    .values({ ...fields(ctx.treeId, child), createdByLinkId: ctx.linkId })
    .returning();
  await db.insert(parentChild).values([
    { treeId: ctx.treeId, parentId: couple.personA, childId: c.id, createdByLinkId: ctx.linkId },
    { treeId: ctx.treeId, parentId: couple.personB, childId: c.id, createdByLinkId: ctx.linkId },
  ]);
  return c;
}

/**
 * Connect an EXISTING person as a parent of an existing child (single/unknown parent,
 * or attaching the 2nd parent after the fact). Cycle-guarded and idempotent.
 */
export async function connectParent(ctx: TreeContext, rawInput: unknown) {
  const { parentId, childId } = connectParentInput.parse(rawInput);
  if (parentId === childId) throw new MutationError("Una persona no puede ser su propio padre o madre.");

  const found = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.treeId, ctx.treeId), inArray(persons.id, [parentId, childId])));
  if (found.length < 2) throw new MutationError("No se encontró la persona.");

  if (await wouldCreateCycle(ctx.treeId, parentId, childId)) {
    throw new MutationError("Eso crearía un ciclo en el árbol.");
  }

  const [existing] = await db
    .select({ id: parentChild.id })
    .from(parentChild)
    .where(and(eq(parentChild.treeId, ctx.treeId), eq(parentChild.parentId, parentId), eq(parentChild.childId, childId)))
    .limit(1);
  if (existing) return; // idempotent — edge already there

  await db.insert(parentChild).values({ treeId: ctx.treeId, parentId, childId, createdByLinkId: ctx.linkId });
}
