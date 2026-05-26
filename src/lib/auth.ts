import { eq } from "drizzle-orm";
import { db } from "@/db";
import { links } from "@/db/schema";
import { hashToken } from "./tokens";

// T2 — the ONE security boundary (eng-review). Every mutation route calls this first.
// V0 is whole-tree edit (Option C): the guard validates token + not-revoked + tree
// membership and reports isOwner. It does NOT enforce per-branch scope (that's V1).
//
// `isOwner` gates owner-only operations (mint links, revoke links). Any valid,
// non-revoked link (owner | open | anchored) may add/edit people in its tree.

export class TokenError extends Error {
  constructor(
    public readonly code: "invalid" | "revoked",
    message: string,
  ) {
    super(message);
    this.name = "TokenError";
  }
}

export interface TreeContext {
  treeId: string;
  linkId: string;
  kind: "owner" | "open" | "anchored";
  isOwner: boolean;
  seedPersonId: string | null;
}

export async function requireTreeContext(rawToken: string | undefined | null): Promise<TreeContext> {
  if (!rawToken) throw new TokenError("invalid", "Falta el enlace de acceso.");

  const tokenHash = hashToken(rawToken);
  const [link] = await db.select().from(links).where(eq(links.tokenHash, tokenHash)).limit(1);

  if (!link) throw new TokenError("invalid", "Este enlace no es válido.");
  if (link.revokedAt) throw new TokenError("revoked", "Este enlace ya no funciona.");

  return {
    treeId: link.treeId,
    linkId: link.id,
    kind: link.kind,
    isOwner: link.kind === "owner",
    seedPersonId: link.seedPersonId ?? null,
  };
}

// Convenience for owner-only routes (mint/revoke links).
export async function requireOwner(rawToken: string | undefined | null): Promise<TreeContext> {
  const ctx = await requireTreeContext(rawToken);
  if (!ctx.isOwner) throw new TokenError("invalid", "Solo el dueño del árbol puede hacer esto.");
  return ctx;
}
