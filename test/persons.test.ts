import { vi, beforeAll, afterEach, describe, it, expect } from "vitest";

vi.mock("@/db", async () => {
  const { testDb } = await import("./db");
  const schema = await import("@/db/schema");
  return { db: testDb, schema };
});

import { migrate, reset, testDb } from "./db";
import { createTree } from "@/lib/links";
import { requireTreeContext, type TreeContext } from "@/lib/auth";
import { addPerson, addRelative, editPerson, getTree, wouldCreateCycle } from "@/lib/persons";
import { persons, parentChild } from "@/db/schema";

beforeAll(() => migrate());
afterEach(() => reset());

async function freshTree(): Promise<TreeContext> {
  const { token } = await createTree("Familia Müller");
  return requireTreeContext(token);
}

describe("person mutations (T4)", () => {
  it("adds a person with a partial date and stamps the contributing link", async () => {
    const ctx = await freshTree();
    const p = await addPerson(ctx, { name: "Johann Müller", birthplace: "Wädenswil", birthYear: 1838 });
    expect(p.name).toBe("Johann Müller");
    expect(p.birthYear).toBe(1838);
    expect(p.birthMonth).toBeNull(); // partial: month/day unknown
    expect(p.createdByLinkId).toBe(ctx.linkId); // attribution
    expect(p.living).toBe(true);
  });

  it("requires a name (shared Zod schema)", async () => {
    const ctx = await freshTree();
    await expect(addPerson(ctx, { name: "  " })).rejects.toBeTruthy();
  });

  it("addRelative(partner) creates a couple edge", async () => {
    const ctx = await freshTree();
    const a = await addPerson(ctx, { name: "Johann" });
    const b = await addRelative(ctx, { person: { name: "Anna" }, relationTo: a.id, relation: "partner" });
    const tree = await getTree(ctx.treeId);
    expect(tree.couples).toHaveLength(1);
    expect([tree.couples[0].personA, tree.couples[0].personB].sort()).toEqual([a.id, b.id].sort());
  });

  it("addRelative(child) creates a parent->child edge", async () => {
    const ctx = await freshTree();
    const parent = await addPerson(ctx, { name: "Juan" });
    const child = await addRelative(ctx, { person: { name: "Marta" }, relationTo: parent.id, relation: "child" });
    const tree = await getTree(ctx.treeId);
    expect(tree.parentChild).toHaveLength(1);
    expect(tree.parentChild[0]).toMatchObject({ parentId: parent.id, childId: child.id });
  });

  it("the data model supports a child with TWO parents (graph, not tree)", async () => {
    const ctx = await freshTree();
    // direct inserts simulate the future connect-existing op; proves the schema is a graph
    const [mom] = await testDb.insert(persons).values({ treeId: ctx.treeId, name: "Rosa" }).returning();
    const [dad] = await testDb.insert(persons).values({ treeId: ctx.treeId, name: "Juan" }).returning();
    const [kid] = await testDb.insert(persons).values({ treeId: ctx.treeId, name: "Marta" }).returning();
    await testDb.insert(parentChild).values([
      { treeId: ctx.treeId, parentId: mom.id, childId: kid.id },
      { treeId: ctx.treeId, parentId: dad.id, childId: kid.id },
    ]);
    const tree = await getTree(ctx.treeId);
    const kidsParents = tree.parentChild.filter((e) => e.childId === kid.id).map((e) => e.parentId).sort();
    expect(kidsParents).toEqual([mom.id, dad.id].sort());
  });

  it("editPerson updates facts and bumps updatedAt (drying-ink freshness)", async () => {
    const ctx = await freshTree();
    const p = await addPerson(ctx, { name: "Lucía", birthYear: 1930 });
    await new Promise((r) => setTimeout(r, 8));
    const edited = await editPerson(ctx, p.id, { name: "Lucía Gauto", birthplace: "Santa Fe", birthYear: 1930 });
    expect(edited.name).toBe("Lucía Gauto");
    expect(edited.birthplace).toBe("Santa Fe");
    expect(edited.updatedAt.getTime()).toBeGreaterThan(p.updatedAt.getTime());
  });

  describe("cycle guard (no one becomes their own ancestor)", () => {
    it("flags a cycle when the proposed parent is a descendant of the child", async () => {
      const ctx = await freshTree();
      // build A -> B -> C
      const [A] = await testDb.insert(persons).values({ treeId: ctx.treeId, name: "A" }).returning();
      const [B] = await testDb.insert(persons).values({ treeId: ctx.treeId, name: "B" }).returning();
      const [C] = await testDb.insert(persons).values({ treeId: ctx.treeId, name: "C" }).returning();
      await testDb.insert(parentChild).values([
        { treeId: ctx.treeId, parentId: A.id, childId: B.id },
        { treeId: ctx.treeId, parentId: B.id, childId: C.id },
      ]);
      // making C a parent of A would close the loop A->B->C->A
      expect(await wouldCreateCycle(ctx.treeId, C.id, A.id)).toBe(true);
      // adding A as parent of C is redundant but NOT a cycle
      expect(await wouldCreateCycle(ctx.treeId, A.id, C.id)).toBe(false);
      // self-parenting is always a cycle
      expect(await wouldCreateCycle(ctx.treeId, A.id, A.id)).toBe(true);
    });
  });
});
