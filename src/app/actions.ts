"use server";

import { z } from "zod";
import { requireTreeContext, requireOwner, TokenError } from "@/lib/auth";
import { addPerson, addRelative, addChildToCouple, addChildWithParents, connectParent, editPerson, getTree, MutationError } from "@/lib/persons";
import { createTree, mintContributeLink, revokeLink } from "@/lib/links";

// Thin "use server" wrappers over the service layer. Every action that mutates a
// tree resolves the capability token FIRST (the one security boundary), then runs
// the validated service call, returning a discriminated result the UI can render
// into the fieldbook-voiced states (loading/error/save-failure) from DESIGN.md.

export type ErrCode = "invalid" | "revoked" | "validation" | "conflict" | "error";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ErrCode; error: string };

function fail(e: unknown): { ok: false; code: ErrCode; error: string } {
  if (e instanceof TokenError) return { ok: false, code: e.code, error: e.message };
  if (e instanceof z.ZodError) {
    return { ok: false, code: "validation", error: e.issues[0]?.message ?? "Datos inválidos." };
  }
  if (e instanceof MutationError) return { ok: false, code: "conflict", error: e.message };
  return { ok: false, code: "error", error: "Algo salió mal. Reintentá." };
}

/** Create a new tree; returns the treeId + the owner admin token (show ONCE). */
export async function createTreeAction(name: string): Promise<ActionResult<{ treeId: string; token: string }>> {
  try {
    const { treeId, token } = await createTree(name);
    return { ok: true, data: { treeId, token } };
  } catch (e) {
    return fail(e);
  }
}

export async function addPersonAction(token: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTreeContext(token);
    const p = await addPerson(ctx, input);
    return { ok: true, data: { id: p.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function addRelativeAction(token: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTreeContext(token);
    const p = await addRelative(ctx, input);
    return { ok: true, data: { id: p.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function editPersonAction(token: string, personId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTreeContext(token);
    const p = await editPerson(ctx, personId, input);
    return { ok: true, data: { id: p.id } };
  } catch (e) {
    return fail(e);
  }
}

/** Add a child to a marriage (both parents linked) — handles remarriage / two parents. */
export async function addChildToCoupleAction(token: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTreeContext(token);
    const c = await addChildToCouple(ctx, input);
    return { ok: true, data: { id: c.id } };
  } catch (e) {
    return fail(e);
  }
}

/** Add a child below a person, optionally creating the other parent inline (forms the couple). */
export async function addChildWithParentsAction(token: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTreeContext(token);
    const c = await addChildWithParents(ctx, input);
    return { ok: true, data: { id: c.id } };
  } catch (e) {
    return fail(e);
  }
}

/** Connect an existing person as a parent (single/unknown parent, or the 2nd parent). */
export async function connectParentAction(token: string, input: unknown): Promise<ActionResult<true>> {
  try {
    const ctx = await requireTreeContext(token);
    await connectParent(ctx, input);
    return { ok: true, data: true };
  } catch (e) {
    return fail(e);
  }
}

/** Read the whole tree for a valid link (any kind). */
export async function getTreeAction(token: string): Promise<ActionResult<Awaited<ReturnType<typeof getTree>>>> {
  try {
    const ctx = await requireTreeContext(token);
    return { ok: true, data: await getTree(ctx.treeId) };
  } catch (e) {
    return fail(e);
  }
}

/** Owner-only: mint an open or anchored contribute link. Returns the raw token once. */
export async function mintLinkAction(
  token: string,
  opts: { kind: "open" | "anchored"; seedPersonId?: string | null; label?: string | null },
): Promise<ActionResult<{ token: string }>> {
  try {
    const ctx = await requireOwner(token);
    const minted = await mintContributeLink(ctx.treeId, opts);
    return { ok: true, data: { token: minted.token } };
  } catch (e) {
    return fail(e);
  }
}

/** Owner-only: revoke a link (the leak defense). */
export async function revokeLinkAction(token: string, linkId: string): Promise<ActionResult<true>> {
  try {
    const ctx = await requireOwner(token);
    await revokeLink(ctx.treeId, linkId);
    return { ok: true, data: true };
  } catch (e) {
    return fail(e);
  }
}
