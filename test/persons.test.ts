import { vi, beforeAll, afterEach, describe, it, expect } from "vitest";

vi.mock("@/db", async () => {
  const { testDb } = await import("./db");
  const schema = await import("@/db/schema");
  return { db: testDb, schema };
});

import { migrate, reset, testDb } from "./db";
import { createTree, mintContributeLink } from "@/lib/links";
import { requireTreeContext, type TreeContext } from "@/lib/auth";
import { addPerson, addRelative, addChildToCouple, addChildWithParents, connectParent, editPerson, getTree, wouldCreateCycle } from "@/lib/persons";
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

  it("addRelative rejects a relationTo from another tree", async () => {
    const a = await freshTree();
    const { token: tokenB } = await createTree("Otra Familia");
    const ctxB = await requireTreeContext(tokenB);
    const foreign = await addPerson(ctxB, { name: "Ajeno" });
    await expect(
      addRelative(a, { person: { name: "Intruso" }, relationTo: foreign.id, relation: "partner" })
    ).rejects.toBeTruthy();
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

  it("getTree resolves authorLabel from the creating link's label (no fallback id)", async () => {
    const owner = await freshTree();
    // a person to anchor the labeled link on
    const seed = await addPerson(owner, { name: "Abuela" });
    // mint a LABELED anchored link, then build a contributor ctx from its token
    const { token } = await mintContributeLink(owner.treeId, {
      kind: "anchored",
      seedPersonId: seed.id,
      label: "Tía Marta",
    });
    const anchoredCtx = await requireTreeContext(token);
    // add a person via that link — its createdByLinkId points at the labeled link
    const added = await addPerson(anchoredCtx, { name: "Prima" });

    const tree = await getTree(owner.treeId);
    const row = tree.persons.find((p) => p.id === added.id)!;
    expect(row.authorLabel).toBe("Tía Marta");

    // a person added via the owner link (no label) gets no authorLabel — never a raw id
    const seedRow = tree.persons.find((p) => p.id === seed.id)!;
    expect(seedRow.authorLabel).toBeUndefined();
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

describe("remarriage, two parents & half-siblings (union-first)", () => {
  it("models a child of a second marriage with the correct two parents", async () => {
    const ctx = await freshTree();
    const father = await addPerson(ctx, { name: "Pedro" });
    const wife1 = await addRelative(ctx, { person: { name: "Primera Esposa" }, relationTo: father.id, relation: "partner" });
    const wife2 = await addRelative(ctx, { person: { name: "Segunda Esposa" }, relationTo: father.id, relation: "partner" });

    const { couples } = await getTree(ctx.treeId);
    expect(couples).toHaveLength(2); // father is in TWO marriages
    const members = (c: { personA: string; personB: string }) => [c.personA, c.personB];
    const couple1 = couples.find((c) => members(c).includes(wife1.id))!;
    const couple2 = couples.find((c) => members(c).includes(wife2.id))!;

    const halfSib = await addChildToCouple(ctx, { coupleId: couple1.id, child: { name: "Media Hermana" } });
    const me = await addChildToCouple(ctx, { coupleId: couple2.id, child: { name: "Yo" } }); // child of the 2nd marriage

    const { parentChild } = await getTree(ctx.treeId);
    const parentsOf = (id: string) => parentChild.filter((e) => e.childId === id).map((e) => e.parentId).sort();

    // each child has exactly the two parents of THEIR marriage
    expect(parentsOf(halfSib.id)).toEqual([father.id, wife1.id].sort());
    expect(parentsOf(me.id)).toEqual([father.id, wife2.id].sort());

    // half-siblings: share the father, differ on the mother
    const sharedFather = parentsOf(halfSib.id).includes(father.id) && parentsOf(me.id).includes(father.id);
    expect(sharedFather).toBe(true);
    expect(parentsOf(halfSib.id).includes(wife2.id)).toBe(false);
    expect(parentsOf(me.id).includes(wife1.id)).toBe(false);
  });

  it("connectParent links an existing second parent and is idempotent", async () => {
    const ctx = await freshTree();
    const dad = await addPerson(ctx, { name: "Papá" });
    const mom = await addPerson(ctx, { name: "Mamá" });
    const kid = await addRelative(ctx, { person: { name: "Nene" }, relationTo: dad.id, relation: "child" });

    await connectParent(ctx, { parentId: mom.id, childId: kid.id });
    await connectParent(ctx, { parentId: mom.id, childId: kid.id }); // idempotent — no dup edge

    const { parentChild } = await getTree(ctx.treeId);
    const parents = parentChild.filter((e) => e.childId === kid.id).map((e) => e.parentId).sort();
    expect(parents).toEqual([dad.id, mom.id].sort());
  });

  it("connectParent rejects a cycle", async () => {
    const ctx = await freshTree();
    const a = await addPerson(ctx, { name: "A" });
    const b = await addRelative(ctx, { person: { name: "B" }, relationTo: a.id, relation: "child" }); // A parent of B
    // making B a parent of A would close A->B->A
    await expect(connectParent(ctx, { parentId: b.id, childId: a.id })).rejects.toBeTruthy();
  });

  it("addChildWithParents (other parent) creates the couple and links BOTH parents", async () => {
    const ctx = await freshTree();
    const hans = await addPerson(ctx, { name: "Hans" }); // no union yet
    const kid = await addChildWithParents(ctx, { parentId: hans.id, otherParentName: "Greta", child: { name: "Nieto" } });

    const { persons: people, couples, parentChild: pc } = await getTree(ctx.treeId);
    expect(people).toHaveLength(3); // Hans + Greta + Nieto
    expect(couples).toHaveLength(1); // a new union formed
    const greta = people.find((p) => p.name === "Greta")!;
    const parents = pc.filter((e) => e.childId === kid.id).map((e) => e.parentId).sort();
    expect(parents).toEqual([hans.id, greta.id].sort()); // both parents linked
    const couple = couples[0];
    expect([couple.personA, couple.personB].sort()).toEqual([hans.id, greta.id].sort());
  });

  it("addChildWithParents (no other parent) makes a single-parent child, no couple", async () => {
    const ctx = await freshTree();
    const solo = await addPerson(ctx, { name: "Solo" });
    const kid = await addChildWithParents(ctx, { parentId: solo.id, child: { name: "Hijo" } });

    const { couples, parentChild: pc } = await getTree(ctx.treeId);
    expect(couples).toHaveLength(0); // no union created
    const parents = pc.filter((e) => e.childId === kid.id).map((e) => e.parentId);
    expect(parents).toEqual([solo.id]); // only the known parent
  });

  // Atomicity (plan 008): the transactional addChildWithParents must commit ALL of its
  // dependent writes together — child + inline other parent + couple + BOTH edges. If the
  // transaction were leaking partial state, this complete-graph assertion would fail. (True
  // mid-transaction-rollback fault injection is a noted follow-up; pglite has no easy hook.)
  it("addChildWithParents creates child + other parent + couple + both edges atomically", async () => {
    const ctx = await freshTree();
    const parent = await addPerson(ctx, { name: "Ana" });
    const child = await addChildWithParents(ctx, { parentId: parent.id, otherParentName: "Luis", child: { name: "Sofi" } });
    const tree = await getTree(ctx.treeId);
    expect(tree.persons.map((p) => p.name).sort()).toEqual(["Ana", "Luis", "Sofi"]);
    expect(tree.couples).toHaveLength(1);
    expect(tree.parentChild.filter((e) => e.childId === child.id)).toHaveLength(2);
  });
});
