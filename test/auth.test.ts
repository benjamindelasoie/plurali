import { vi, beforeAll, afterEach, describe, it, expect } from "vitest";

// Point the code under test at the in-process PGlite db.
vi.mock("@/db", async () => {
  const { testDb } = await import("./db");
  const schema = await import("@/db/schema");
  return { db: testDb, schema };
});

import { migrate, reset } from "./db";
import { createTree, mintContributeLink, revokeLink } from "@/lib/links";
import { requireTreeContext, requireOwner, TokenError } from "@/lib/auth";

beforeAll(() => migrate());
afterEach(() => reset());

describe("capability token guard (T2)", () => {
  it("an owner link resolves to an owner context", async () => {
    const { treeId, token } = await createTree("Familia Müller");
    const ctx = await requireTreeContext(token);
    expect(ctx.treeId).toBe(treeId);
    expect(ctx.kind).toBe("owner");
    expect(ctx.isOwner).toBe(true);
  });

  it("rejects an unknown token as invalid", async () => {
    await expect(requireTreeContext("not-a-real-token")).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects a missing token", async () => {
    await expect(requireTreeContext(undefined)).rejects.toBeInstanceOf(TokenError);
  });

  it("rejects a REVOKED link (mandatory security test)", async () => {
    const { treeId, token: ownerTok } = await createTree("T");
    const { linkId, token: contribTok } = await mintContributeLink(treeId, { kind: "open" });
    // works before revocation
    await expect(requireTreeContext(contribTok)).resolves.toMatchObject({ isOwner: false });
    await revokeLink(treeId, linkId);
    await expect(requireTreeContext(contribTok)).rejects.toMatchObject({ code: "revoked" });
    // the owner link still works
    await expect(requireTreeContext(ownerTok)).resolves.toMatchObject({ isOwner: true });
  });

  it("anchored links carry their seed person and are NOT owners", async () => {
    const { treeId } = await createTree("T");
    const { token } = await mintContributeLink(treeId, {
      kind: "anchored",
      seedPersonId: "00000000-0000-0000-0000-000000000000",
    });
    const ctx = await requireTreeContext(token);
    expect(ctx.kind).toBe("anchored");
    expect(ctx.isOwner).toBe(false);
    expect(ctx.seedPersonId).toBe("00000000-0000-0000-0000-000000000000");
  });

  it("requireOwner blocks a contribute link", async () => {
    const { treeId, token: ownerTok } = await createTree("T");
    const { token: contribTok } = await mintContributeLink(treeId, { kind: "open" });
    await expect(requireOwner(ownerTok)).resolves.toMatchObject({ isOwner: true });
    await expect(requireOwner(contribTok)).rejects.toBeInstanceOf(TokenError);
  });
});
