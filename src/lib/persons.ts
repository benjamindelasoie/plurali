import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { persons, couples, parentChild } from "@/db/schema";
import { personInput, addRelativeInput } from "./validation";
import type { TreeContext } from "./auth";
import type { PersonInput } from "./validation";

// T4 — person mutations (eng-review). Pure service layer; routes/actions call these
// after requireTreeContext. All writes stamp the contributing link (attribution) and
// bump updatedAt so the drying-ink freshness signal works.

export class MutationError extends Error {}

/** Load a whole tree in 2 queries (perf review: never N+1 per node). */
export async function getTree(treeId: string) {
  const [people, coupleRows, pcRows] = await Promise.all([
    db.select().from(persons).where(eq(persons.treeId, treeId)),
    db.select().from(couples).where(eq(couples.treeId, treeId)),
    db.select().from(parentChild).where(eq(parentChild.treeId, treeId)),
  ]);
  return { persons: people, couples: coupleRows, parentChild: pcRows };
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
