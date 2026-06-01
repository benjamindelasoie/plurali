import { GraphQLError } from "graphql";
import { requireTreeContext, TokenError } from "@/lib/auth";
import { getTree } from "@/lib/persons";
import { buildIndex } from "./treeIndex";
import type { GraphQLContext } from "./resolvers";

// The GraphQL context IS the security boundary, reusing requireTreeContext (the one
// boundary the rest of the app uses). The capability token rides in the Authorization
// header (Bearer) — falls back to x-plurali-token, or ?k= for dev/GraphiQL poking.
// On success we preload the whole tree ONCE; resolvers stay pure over it.

export function extractToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null;
  const x = request.headers.get("x-plurali-token");
  if (x) return x.trim() || null;
  try {
    const k = new URL(request.url).searchParams.get("k");
    if (k) return k;
  } catch {
    /* relative URL in tests — ignore */
  }
  return null;
}

function unauthenticated(message: string, reason: string): never {
  throw new GraphQLError(message, { extensions: { code: "UNAUTHENTICATED", reason } });
}

export async function buildContext(request: Request): Promise<GraphQLContext> {
  const token = extractToken(request);
  if (!token) {
    console.warn("[graphql] request without a capability token");
    unauthenticated("Falta el enlace de acceso.", "missing");
  }
  let ctx;
  try {
    ctx = await requireTreeContext(token);
  } catch (e) {
    const reason = e instanceof TokenError ? e.code : "invalid";
    console.warn(`[graphql] token rejected (${reason})`);
    unauthenticated(e instanceof TokenError ? e.message : "Este enlace no es válido.", reason);
  }
  const tree = await getTree(ctx.treeId);
  return { treeId: ctx.treeId, tree, index: buildIndex(tree) };
}
