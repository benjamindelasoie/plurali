import { headers } from "next/headers";
import { getTreeAction } from "@/app/actions";
import { fetchTreeViaGraphQL } from "@/lib/graphqlClient";
import { TreeExplorer } from "@/components/TreeExplorer";

// The capability token in ?k= determines the tree (the [treeId] path is cosmetic).
// ?gql=1 reads through the PARALLEL GraphQL layer instead of getTreeAction (the
// default). Same TreeExplorer, same data shape — a disposable learning path.
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
      const h = await headers();
      const host = h.get("host") ?? "localhost:3000";
      const proto =
        h.get("x-forwarded-proto") ??
        (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
      data = await fetchTreeViaGraphQL(token, `${proto}://${host}`);
    } catch (e) {
      err = e instanceof Error ? e.message : "Este enlace no es válido.";
    }
    if (!data) return <LinkError message={err ?? "Este enlace no es válido."} />;
    return <TreeExplorer tree={data} treeName={data.name} token={token} />;
  }

  const res = await getTreeAction(token);
  if (!res.ok) return <LinkError message={res.error} />;
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
