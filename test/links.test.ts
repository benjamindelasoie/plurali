import { vi, beforeAll, afterEach, describe, it, expect } from "vitest";

// Point the code under test at the in-process PGlite db.
vi.mock("@/db", async () => {
  const { testDb } = await import("./db");
  const schema = await import("@/db/schema");
  return { db: testDb, schema };
});

import { migrate, reset } from "./db";
import { createTree, mintContributeLink } from "@/lib/links";
import { requireTreeContext } from "@/lib/auth";
import { addPerson } from "@/lib/persons";

beforeAll(() => migrate());
afterEach(() => reset());

describe("mintContributeLink — anchored seedPersonId validation (SECURITY-02)", () => {
  it("mints an anchored link for a person that belongs to the tree", async () => {
    const { treeId, token } = await createTree("Familia Müller");
    const ctx = await requireTreeContext(token);
    const seed = await addPerson(ctx, { name: "Lucía" });
    const { token: anchoredTok } = await mintContributeLink(treeId, {
      kind: "anchored",
      seedPersonId: seed.id,
    });
    const anchoredCtx = await requireTreeContext(anchoredTok);
    expect(anchoredCtx.kind).toBe("anchored");
    expect(anchoredCtx.seedPersonId).toBe(seed.id);
  });

  it("rejects an anchored link whose seed person does not exist", async () => {
    const { treeId } = await createTree("Familia Müller");
    await expect(
      mintContributeLink(treeId, {
        kind: "anchored",
        seedPersonId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow();
  });

  it("rejects an anchored link whose seed person belongs to ANOTHER tree (cross-tenant)", async () => {
    const { treeId: treeA } = await createTree("Familia A");
    const { token: tokenB } = await createTree("Familia B");
    const ctxB = await requireTreeContext(tokenB);
    const foreign = await addPerson(ctxB, { name: "Ajeno" });
    // foreign belongs to tree B; minting an anchored link in tree A pointed at it must fail.
    await expect(
      mintContributeLink(treeA, { kind: "anchored", seedPersonId: foreign.id }),
    ).rejects.toThrow();
  });

  it("still rejects an anchored link with no seed person at all", async () => {
    const { treeId } = await createTree("Familia Müller");
    await expect(
      mintContributeLink(treeId, { kind: "anchored" }),
    ).rejects.toThrow();
  });
});
