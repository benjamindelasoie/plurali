import { getTreeAction } from "@/app/actions";
import { TreeExplorer } from "@/components/TreeExplorer";

// The capability token in ?k= determines the tree (the [treeId] path is cosmetic).
export default async function TreePage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>;
}) {
  const { k } = await searchParams;
  const res = await getTreeAction(k ?? "");

  if (!res.ok) return <LinkError message={res.error} />;
  return <TreeExplorer tree={res.data} treeName={res.data.name} token={k ?? ""} />;
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
