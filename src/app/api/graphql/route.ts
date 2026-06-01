import { makeYoga } from "@/graphql/server";
import { buildContext } from "@/graphql/context";

// Yoga + Drizzle/Neon + the auth helpers are Node-only, not edge-safe.
export const runtime = "nodejs";
// Token-scoped data must never be cached or shared across requests.
export const dynamic = "force-dynamic";

const yoga = makeYoga(buildContext);

function handler(request: Request) {
  return yoga.handleRequest(request, {});
}

export { handler as GET, handler as POST, handler as OPTIONS };
