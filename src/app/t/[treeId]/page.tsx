import { getTreeAction } from "@/app/actions";
import { fetchTreeViaGraphQL } from "@/lib/graphqlClient";
import { TreeExplorer } from "@/components/TreeExplorer";

// The capability token in ?k= determines the tree (the [treeId] path is cosmetic).
// ?gql=1 reads through the PARALLEL GraphQL layer instead of getTreeAction (the
// default). Same TreeExplorer, same data shape — a disposable learning path.

// A bad/revoked/missing link is a dead end for the recipient — give them the warm,
// actionable fieldbook line from DESIGN.md (interaction states), not a cold default.
const LINK_DEAD = "este enlace ya no funciona — pedile uno nuevo a quien te invitó";
export default async function TreePage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string; gql?: string }>;
}) {
  const { k, gql } = await searchParams;
  const token = k ?? "";

  if (gql) {
    // Fetch in try/catch, render outside it (rendering errors belong to an error
    // boundary, not this catch — eslint react-hooks/error-boundaries).
    let data: Awaited<ReturnType<typeof fetchTreeViaGraphQL>> | null = null;
    let err: string | null = null;
    try {
      // Pin the self-fetch origin to a TRUSTED source — never the inbound Host header,
      // which an attacker can poison to redirect this token-bearing request elsewhere.
      // Prefer explicit APP_ORIGIN, then Vercel-injected URLs, then the dev fallback.
      const origin =
        process.env.APP_ORIGIN ??
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000");
      data = await fetchTreeViaGraphQL(token, origin);
    } catch {
      err = LINK_DEAD;
    }
    if (!data) return <LinkError message={err ?? LINK_DEAD} />;
    return <TreeExplorer tree={data} treeName={data.name} token={token} />;
  }

  const res = await getTreeAction(token);
  if (!res.ok) return <LinkError message={LINK_DEAD} />;
  return <TreeExplorer tree={res.data} treeName={res.data.name} token={token} />;
}

function LinkError({ message }: { message: string }) {
  return (
    <main
      style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 10, padding: 24, textAlign: "center",
      }}
    >
      <div className="display" style={{ fontSize: 26 }}>
        plurali<span style={{ color: "var(--vine)" }}>.</span>
      </div>
      <p style={{ fontStyle: "italic", color: "var(--muted)", maxWidth: "42ch", lineHeight: 1.6 }}>
        {message}
      </p>
    </main>
  );
}
