"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ReactFlow, Background, BackgroundVariant, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PersonNode } from "./PersonNode";
import { AddRelative, EditPerson, type Union } from "./AddRelative";
import { buildGraph, freshness, personLine, type TreeData, type PersonRow } from "@/lib/flow";

const nodeTypes = { person: PersonNode };

export function TreeExplorer({
  tree,
  treeName,
  token,
}: {
  tree: TreeData;
  treeName: string;
  token: string;
}) {
  const router = useRouter();
  const base = useMemo(() => buildGraph(tree), [tree]);
  const [selected, setSelected] = useState<string | null>(null);
  const onSelect = useCallback((id: string) => setSelected(id), []);

  // Re-fetch the tree (server component) after any mutation. New people land fresh.
  const refresh = useCallback(() => router.refresh(), [router]);

  const nodes = useMemo(
    () =>
      base.nodes.map((n) => ({
        ...n,
        selected: n.id === selected,
        data: { ...n.data, dim: selected != null && n.id !== selected, onSelect },
      })),
    [base, selected, onSelect],
  );

  const edges = useMemo(
    () =>
      base.edges.map((e) => {
        const lit = selected != null && (e.source === selected || e.target === selected);
        const dim = selected != null && !lit;
        return {
          ...e,
          style: {
            stroke: "#5c6b3e",
            strokeWidth: e.data.kind === "couple" ? 2.6 : 1.6,
            opacity: dim ? 0.15 : lit ? 0.85 : 0.5,
          },
        };
      }),
    [base, selected],
  );

  const onNodeClick = useCallback((_: unknown, node: Node) => setSelected(node.id), []);
  const sel: PersonRow | null = useMemo(
    () => tree.persons.find((p) => p.id === selected) ?? null,
    [tree.persons, selected],
  );

  // Unions for the selected person (couple edges they belong to) -> the union picker.
  const personById = useMemo(() => new Map(tree.persons.map((p) => [p.id, p])), [tree.persons]);
  const unions: Union[] = useMemo(() => {
    if (!sel) return [];
    return tree.couples
      .filter((c) => c.id && (c.personA === sel.id || c.personB === sel.id))
      .map((c) => {
        const partnerId = c.personA === sel.id ? c.personB : c.personA;
        return { coupleId: c.id as string, partnerName: personById.get(partnerId)?.name ?? "alguien" };
      });
  }, [sel, tree.couples, personById]);

  const empty = tree.persons.length === 0;

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <header style={{ position: "absolute", top: 18, left: 24, zIndex: 10 }}>
        <div className="display" style={{ fontSize: 22 }}>
          plurali<span style={{ color: "var(--vine)" }}>.</span>
        </div>
        <div style={{ fontStyle: "italic", color: "var(--muted)", fontSize: 13, marginTop: 2 }}>
          {treeName} · {tree.persons.length} {tree.persons.length === 1 ? "persona" : "personas"}
        </div>
      </header>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={() => setSelected(null)}
        nodesDraggable={false}
        nodesConnectable={false}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#e3dccb" gap={28} size={1} />
      </ReactFlow>

      {empty ? <EmptyState token={token} onDone={refresh} /> : null}

      {sel ? (
        <DetailCard
          key={sel.id}
          person={sel}
          token={token}
          unions={unions}
          onClose={() => setSelected(null)}
          onDone={refresh}
        />
      ) : null}

      {!empty ? (
        <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", fontStyle: "italic", color: "var(--muted)", fontSize: 12, opacity: 0.85 }}>
          arrastrá para explorar · clic en una persona para traerla al frente
        </div>
      ) : null}
    </div>
  );
}

// Empty tree: the owner's first action. DESIGN.md empty state voice.
function EmptyState({ token, onDone }: { token: string; onDone: () => void }) {
  return (
    <div
      style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: 24, zIndex: 11,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <h1 className="pl-display" style={{ fontSize: 26 }}>Empezá agregándote a vos.</h1>
        <p className="pl-sub">Después sumás a tus padres, tu pareja, tus hijos — o invitás a la familia a que lo hagan.</p>
      </div>
      <aside
        style={{
          marginTop: 24, width: "100%", maxWidth: 380,
          background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 14,
          padding: "22px 24px", boxShadow: "0 30px 70px -30px rgba(34,32,27,.4)",
        }}
      >
        <AddRelative token={token} personId={null} unions={[]} onDone={onDone} />
      </aside>
    </div>
  );
}

function DetailCard({
  person,
  token,
  unions,
  onClose,
  onDone,
}: {
  person: PersonRow;
  token: string;
  unions: Union[];
  onClose: () => void;
  onDone: () => void;
}) {
  const f = freshness(person.updatedAt);
  const line = personLine(person);
  const [editing, setEditing] = useState(false);
  return (
    <aside
      style={{
        position: "absolute", right: 28, top: 92, width: 340, zIndex: 12,
        maxHeight: "calc(100vh - 120px)", overflowY: "auto",
        background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 14,
        padding: "20px 22px 18px", boxShadow: "0 30px 70px -30px rgba(34,32,27,.5)",
      }}
    >
      <button
        onClick={onClose}
        aria-label="cerrar"
        style={{ position: "absolute", top: 8, right: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "none", color: "var(--muted)", cursor: "pointer", fontSize: 20, lineHeight: 1 }}
      >
        ×
      </button>
      <div className="display" style={{ fontSize: 28, lineHeight: 1.05, color: f.fresh ? "var(--fresh)" : "var(--ink)" }}>
        {person.name}
      </div>

      {editing ? (
        <div style={{ marginTop: 14 }}>
          <EditPerson token={token} person={person} onDone={() => { setEditing(false); onDone(); }} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <>
          {line ? (
            <div style={{ fontStyle: "italic", fontSize: 14, marginTop: 6 }}>{line}</div>
          ) : (
            <div style={{ fontStyle: "italic", fontSize: 14, marginTop: 6, color: "var(--muted)" }}>sin datos todavía</div>
          )}
          {f.fresh ? (
            <div className="pl-fresh-tag" style={{ marginTop: 10 }}>agregada {f.label}</div>
          ) : null}
          <div style={{ marginTop: 10 }}>
            <button className="pl-act" style={{ fontSize: 13 }} onClick={() => setEditing(true)}>editar sus datos</button>
          </div>
          <hr style={{ border: "none", borderTop: "1px solid var(--hairline)", margin: "16px 0" }} />
          <AddRelative
            token={token}
            personId={person.id}
            personName={person.name}
            unions={unions}
            onDone={onDone}
          />
        </>
      )}
    </aside>
  );
}
