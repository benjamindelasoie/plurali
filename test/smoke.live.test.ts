import { config } from "dotenv";
import { describe, it, expect } from "vitest";

// Load the real Neon URL BEFORE the dynamic imports below evaluate @/db.
config({ path: ".env.local" });

// Runs only when PLURALI_LIVE=1 (so normal `npm test` stays on PGlite and never
// touches Neon). Dynamic imports run AFTER config() so @/db reads DATABASE_URL.
describe.runIf(process.env.PLURALI_LIVE)("LIVE smoke against Neon", () => {
  it("create tree → mint link → father + 2 marriages → child of 2nd marriage → read back", async () => {
    const { createTree, mintContributeLink } = await import("@/lib/links");
    const { requireTreeContext } = await import("@/lib/auth");
    const { addPerson, addRelative, addChildToCouple, getTree } = await import("@/lib/persons");
    const { db } = await import("@/db");
    const { trees } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const { treeId, token: ownerTok } = await createTree("Familia (smoke test)");
    try {
      const owner = await requireTreeContext(ownerTok);
      expect(owner.isOwner).toBe(true);

      // owner seeds the father, then mints an ANCHORED contribute link at him
      const father = await addPerson(owner, { name: "Pedro", birthYear: 1940 });
      const { token: contribTok } = await mintContributeLink(treeId, {
        kind: "anchored",
        seedPersonId: father.id,
      });

      // a "cousin" opens the contribute link (no signup) and fills in the family
      const cousin = await requireTreeContext(contribTok);
      expect(cousin.isOwner).toBe(false);
      expect(cousin.treeId).toBe(treeId);

      const w1 = await addRelative(cousin, { person: { name: "Primera Esposa" }, relationTo: father.id, relation: "partner" });
      const w2 = await addRelative(cousin, { person: { name: "Segunda Esposa" }, relationTo: father.id, relation: "partner" });

      const { couples } = await getTree(treeId);
      const secondMarriage = couples.find((c) => [c.personA, c.personB].includes(w2.id))!;
      const me = await addChildToCouple(cousin, { coupleId: secondMarriage.id, child: { name: "Yo" } });

      // read back: I am the child of the SECOND marriage — parents are father + w2, not w1
      const tree = await getTree(treeId);
      const myParents = tree.parentChild.filter((e) => e.childId === me.id).map((e) => e.parentId).sort();
      expect(myParents).toEqual([father.id, w2.id].sort());
      expect(myParents).not.toContain(w1.id);
      expect(tree.persons).toHaveLength(4);
      expect(tree.couples).toHaveLength(2);

      console.log(
        `\n  LIVE OK ✓  tree=${treeId}\n  ${tree.persons.length} people · ${tree.couples.length} marriages · ` +
          `child-of-2nd-marriage parents verified against Neon.\n`,
      );
    } finally {
      await db.delete(trees).where(eq(trees.id, treeId)); // cleanup (cascades)
    }
  });
});
