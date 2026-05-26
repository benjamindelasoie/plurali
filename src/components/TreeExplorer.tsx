"use client";

import { useCallback, useMemo, useState } from "react";
import { ReactFlow, Background, BackgroundVariant, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PersonNode } from "./PersonNode";
import { buildGraph, freshness, personLine, type TreeData, type PersonRow } from "@/lib/flow";

const nodeTypes = { person: PersonNode };

export function TreeExplorer({ tree, treeName }: { tree: TreeData; treeName: string }) {
  const base = useMemo(() => buildGraph(tree), [tree]);
  const [selected, setSelected] = useState<string | null>(null);
  const onSelect = useCallback((id: string) => setSelected(id), []);

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

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <header style={{ position: "absolute", top: 18, left: 24, zIndex: 10 }}>
        <div className="display" style={{ fontSize: 22 }}>
          plurali<span style={{ color: "var(--vine)" }}>.</span>
        </div>
        <div style={{ fontStyle: "italic", color: "var(--muted)", fontSize: 13, marginTop: 2 }}>
          {treeName} · {tree.persons.length} personas
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

      {sel ? <DetailCard person={sel} onClose={() => setSelected(null)} /> : null}

      <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", fontStyle: "italic", color: "var(--muted)", fontSize: 12, opacity: 0.85 }}>
        arrastrá para explorar · clic en una persona para traerla al frente
      </div>
    </div>
  );
}

function DetailCard({ person, onClose }: { person: PersonRow; onClose: () => void }) {
  const f = freshness(person.updatedAt);
  return (
    <aside
      style={{
        position: "absolute", right: 28, top: 92, width: 320, zIndex: 12,
        background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 14,
        padding: "20px 22px 18px", boxShadow: "0 30px 70px -30px rgba(34,32,27,.5)",
      }}
    >
      <button
        onClick={onClose}
        aria-label="cerrar"
        style={{ position: "absolute", top: 12, right: 14, border: "none", background: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16 }}
      >
        ×
      </button>
      <div className="display" style={{ fontSize: 28, lineHeight: 1.05, color: f.fresh ? "var(--fresh)" : "var(--ink)" }}>
        {person.name}
      </div>
      {personLine(person) ? (
        <div style={{ fontStyle: "italic", fontSize: 14, marginTop: 6 }}>{personLine(person)}</div>
      ) : (
        <div style={{ fontStyle: "italic", fontSize: 14, marginTop: 6, color: "var(--muted)" }}>sin datos todavía</div>
      )}
      {f.fresh ? (
        <div style={{ fontStyle: "italic", fontSize: 13, color: "var(--fresh)", marginTop: 10 }}>
          agregada {f.label}
        </div>
      ) : null}
      <hr style={{ border: "none", borderTop: "1px solid var(--hairline)", margin: "16px 0" }} />
      <span style={{ fontSize: 13.5, color: "var(--vine)", cursor: "pointer" }}>+ agregar familiar</span>
    </aside>
  );
}
