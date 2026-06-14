import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { trees, links, persons } from "@/db/schema";
import { generateToken, hashToken } from "./tokens";

// T3 — capability links (eng-review + design-review).
// Raw tokens are returned ONCE and never stored; only their hash is persisted.
// The caller is responsible for showing/recovering the raw token (copy / mailto /
// download for the owner link). Routes that mint/revoke must call requireOwner first.

export interface MintedLink {
  linkId: string;
  /** raw token — show once, never persisted. Goes in the URL: /t/{treeId}?k={token} */
  token: string;
}

/** Create a tree and mint its owner/admin link. Anyone may create a tree. */
export async function createTree(name: string): Promise<{ treeId: string } & MintedLink> {
  const [tree] = await db.insert(trees).values({ name }).returning({ id: trees.id });
  const token = generateToken();
  const [link] = await db
    .insert(links)
    .values({ treeId: tree.id, tokenHash: hashToken(token), kind: "owner" })
    .returning({ id: links.id });
  return { treeId: tree.id, linkId: link.id, token };
}

/**
 * Mint a contribute link (owner-only — enforce requireOwner in the route).
 *  - open: one un-anchored "join the tree" link (the WhatsApp link).
 *  - anchored: lands the recipient AT seedPersonId ("sos vos? agregá tu familia").
 *    The anchor is an ENTRY POINT, not an edit restriction (V0 = whole-tree edit).
 */
export async function mintContributeLink(
  treeId: string,
  opts: { kind: "open" | "anchored"; seedPersonId?: string | null; label?: string | null },
): Promise<MintedLink> {
  if (opts.kind === "anchored" && !opts.seedPersonId) {
    throw new Error("Un enlace anclado necesita una persona de referencia.");
  }
  // SECURITY-02: an anchored link's seed person MUST belong to this tree — otherwise
  // an owner could mint a link that lands recipients on a person from another tree.
  if (opts.kind === "anchored" && opts.seedPersonId) {
    const [seed] = await db
      .select({ id: persons.id })
      .from(persons)
      .where(and(eq(persons.id, opts.seedPersonId), eq(persons.treeId, treeId)))
      .limit(1);
    if (!seed) {
      throw new Error("La persona de referencia no pertenece a este árbol.");
    }
  }
  const token = generateToken();
  const [link] = await db
    .insert(links)
    .values({
      treeId,
      tokenHash: hashToken(token),
      kind: opts.kind,
      seedPersonId: opts.kind === "anchored" ? opts.seedPersonId : null,
      label: opts.label ?? null,
    })
    .returning({ id: links.id });
  return { linkId: link.id, token };
}

/** Revoke a link (owner-only). Idempotent. The leak defense — make it prominent in UI. */
export async function revokeLink(treeId: string, linkId: string): Promise<void> {
  await db
    .update(links)
    .set({ revokedAt: new Date() })
    .where(and(eq(links.id, linkId), eq(links.treeId, treeId)));
}

/** List a tree's links for the owner's "manage links" view (no token hashes exposed). */
export async function listLinks(treeId: string) {
  return db
    .select({
      id: links.id,
      kind: links.kind,
      seedPersonId: links.seedPersonId,
      label: links.label,
      revokedAt: links.revokedAt,
      createdAt: links.createdAt,
    })
    .from(links)
    .where(eq(links.treeId, treeId));
}
