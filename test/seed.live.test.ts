import { config } from "dotenv";
import { describe, it } from "vitest";

config({ path: ".env.local" });

// Seeds a PERSISTENT demo tree on Neon (no cleanup) and writes the view URL to
// /tmp/plurali-seed.txt. Gated on PLURALI_SEED so it never runs in `npm test`.
describe.runIf(process.env.PLURALI_SEED)("seed demo tree", () => {
  it("Müller family with a remarriage + a fresh entry", async () => {
    const { writeFileSync } = await import("node:fs");
    const { createTree } = await import("@/lib/links");
    const { requireTreeContext } = await import("@/lib/auth");
    const { addPerson, addRelative, addChildToCouple, getTree } = await import("@/lib/persons");

    const { treeId, token } = await createTree("Familia Müller");
    const ctx = await requireTreeContext(token);

    const johann = await addPerson(ctx, { name: "Johann Müller", birthplace: "Wädenswil", birthYear: 1838, deathYear: 1909, living: false });
    const anna = await addRelative(ctx, { person: { name: "Anna Keller", birthYear: 1841, living: false }, relationTo: johann.id, relation: "partner" });

    const c1 = (await getTree(treeId)).couples.find((c) => [c.personA, c.personB].includes(anna.id))!;
    const juan = await addChildToCouple(ctx, { coupleId: c1.id, child: { name: "Juan Müller", birthplace: "Esperanza", birthYear: 1871, living: false } });

    // Juan remarried: two unions
    const rosa = await addRelative(ctx, { person: { name: "Rosa Vögeli", birthYear: 1875, living: false }, relationTo: juan.id, relation: "partner" });
    const elena = await addRelative(ctx, { person: { name: "Elena Britos", birthYear: 1880, living: false }, relationTo: juan.id, relation: "partner" });
    const cs = (await getTree(treeId)).couples;
    const has = (c: { personA: string; personB: string }, a: string, b: string) =>
      [c.personA, c.personB].includes(a) && [c.personA, c.personB].includes(b);
    const juanRosa = cs.find((c) => has(c, juan.id, rosa.id))!;
    const juanElena = cs.find((c) => has(c, juan.id, elena.id))!;

    await addChildToCouple(ctx, { coupleId: juanRosa.id, child: { name: "Marta Müller", birthplace: "Rafaela", birthYear: 1903, living: false } });
    await addChildToCouple(ctx, { coupleId: juanElena.id, child: { name: "Pedro Müller", birthYear: 1906, living: false } });
    await addChildToCouple(ctx, { coupleId: juanElena.id, child: { name: "Lucía Gauto", birthplace: "Santa Fe", birthYear: 1930, living: false } });

    writeFileSync("/tmp/plurali-seed.txt", `http://localhost:3000/t/${treeId}?k=${encodeURIComponent(token)}\n`);
    console.log(`SEED OK -> /tmp/plurali-seed.txt`);
  });
});
