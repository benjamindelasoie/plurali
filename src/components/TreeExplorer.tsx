"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ReactFlow, Background, BackgroundVariant, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PersonNode, type AddRelation } from "./PersonNode";
import { UnionNode } from "./UnionNode";
import { AddRelative, AddPanel, EditPerson, type Union } from "./AddRelative";
import { buildGraph, freshness, personLine, type TreeData, type PersonRow } from "@/lib/flow";

const nodeTypes = { person: PersonNode, union: UnionNode };

type AddIntent = { personId: string; personName: string; relation: AddRelation };

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
  const [addMode, setAddMode] = useState(false);
  const [addIntent, setAddIntent] = useState<AddIntent | null>(null);
  // Enable position transitions only after first paint, so nodes don't glide in
  // from the origin on initial load (they fade in via the .pnode animation instead).
  const [motionReady, setMotionReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMotionReady(true), 120);
    return () => clearTimeout(t);
  }, []);

  const refresh = useCallback(() => router.refresh(), [router]);

  // Re-fit the view when the family grows: React Flow's `fitView` PROP only runs on
  // mount, and adds happen via router.refresh() (no remount), so a newly added person
  // can land below the fold — you can't see who you just added. Capture a fit callback
  // on init and re-run it whenever the person count changes.
  const fit = useRef<(() => void) | null>(null);
  const personCount = tree.persons.length;
  useEffect(() => {
    fit.current?.();
  }, [personCount]);

  const personById = useMemo(() => new Map(tree.persons.map((p) => [p.id, p])), [tree.persons]);
  // Unions for any person (couple edges they belong to) -> the union picker.
  const unionsFor = useCallback(
    (pid: string): Union[] =>
      tree.couples
        .filter((c) => c.id && (c.personA === pid || c.personB === pid))
        .map((c) => {
          const partnerId = c.personA === pid ? c.personB : c.personA;
          return { coupleId: c.id as string, partnerName: personById.get(partnerId)?.name ?? "alguien" };
        }),
    [tree.couples, personById],
  );

  const onSelect = useCallback((id: string) => setSelected(id), []);
  const onAdd = useCallback(
    (id: string, relation: AddRelation) => {
      setAddIntent({ personId: id, personName: personById.get(id)?.name ?? "", relation });
    },
    [personById],
  );

  const toggleAddMode = useCallback(() => {
    setAddMode((m) => {
      const next = !m;
      setSelected(null);
      setAddIntent(null);
      return next;
    });
  }, []);

  const nodes = useMemo(
    () =>
      base.nodes.map((n) =>
        n.type === "person"
          ? {
              ...n,
              selected: n.id === selected,
              data: { ...n.data, dim: selected != null && n.id !== selected, addMode, onSelect, onAdd },
            }
          : n,
      ),
    [base, selected, addMode, onSelect, onAdd],
  );

  const edges = useMemo(
    () =>
      base.edges.map((e) => {
        const lit = selected != null && (e.source === selected || e.target === selected);
        const dim = selected != null && !lit;
        return {
          ...e,
          pathOptions: { borderRadius: 16 },
          style: {
            stroke: "#5c6b3e",
            strokeWidth: e.data.kind === "couple" ? 2.2 : 1.4,
            opacity: dim ? 0.18 : lit ? 0.9 : 0.5,
          },
        };
      }),
    [base, selected],
  );

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      if (!addMode) setSelected(node.id);
    },
    [addMode],
  );

  const sel: PersonRow | null = useMemo(
    () => tree.persons.find((p) => p.id === selected) ?? null,
    [tree.persons, selected],
  );
  const selUnions = useMemo(() => (sel ? unionsFor(sel.id) : []), [sel, unionsFor]);
  const selRels = useMemo(() => {
    if (!sel) return { parents: [] as string[], children: [] as string[] };
    const name = (id: string) => personById.get(id)?.name;
    const parents = tree.parentChild.filter((e) => e.childId === sel.id).map((e) => name(e.parentId)).filter((n): n is string => !!n);
    const children = tree.parentChild.filter((e) => e.parentId === sel.id).map((e) => name(e.childId)).filter((n): n is string => !!n);
    return { parents, children };
  }, [sel, tree.parentChild, personById]);
  const empty = tree.persons.length === 0;

  return (
    <div className={motionReady ? "motion-ready" : undefined} style={{ position: "fixed", inset: 0 }}>
      <header style={{ position: "absolute", top: 18, left: 24, zIndex: 10 }}>
        <div className="display" style={{ fontSize: 22 }}>
          plurali<span style={{ color: "var(--vine)" }}>.</span>
        </div>
        <div
          style={{
            fontStyle: "italic", color: "var(--muted)", fontSize: 13, marginTop: 2,
            maxWidth: "calc(100vw - 220px)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {treeName} · {tree.persons.length} {tree.persons.length === 1 ? "persona" : "personas"}
        </div>
      </header>

      {!empty ? (
        <button
          onClick={toggleAddMode}
          className={addMode ? "pl-btn pl-btn--ghost" : "pl-btn"}
          style={{ position: "absolute", top: 18, right: 24, zIndex: 13 }}
        >
          {addMode ? "Listo" : "Agregar familiares"}
        </button>
      ) : null}

      {addMode && !addIntent ? (
        <div
          style={{
            position: "absolute", top: 64, left: "50%", transform: "translateX(-50%)", zIndex: 11,
            fontStyle: "italic", color: "var(--muted)", fontSize: 13.5, textAlign: "center",
            maxWidth: "min(560px, calc(100vw - 48px))",
          }}
        >
          pasá el mouse sobre una persona y elegí qué sumar — arriba madre/padre, al lado pareja, abajo hijo/a
        </div>
      ) : null}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(inst) => { fit.current = () => inst.fitView({ padding: 0.25, duration: 400 }); }}
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

      {/* Add panel (directional add-mode) takes precedence over the detail card. */}
      {addIntent ? (
        <FloatingCard onClose={() => setAddIntent(null)}>
          <AddPanel
            key={`${addIntent.relation}-${addIntent.personId}`}
            token={token}
            personId={addIntent.personId}
            personName={addIntent.personName}
            relation={addIntent.relation}
            unions={unionsFor(addIntent.personId)}
            onDone={() => { setAddIntent(null); refresh(); }}
            onCancel={() => setAddIntent(null)}
          />
        </FloatingCard>
      ) : sel && !addMode ? (
        <DetailCard
          key={sel.id}
          person={sel}
          token={token}
          unions={selUnions}
          parents={selRels.parents}
          childNames={selRels.children}
          onClose={() => setSelected(null)}
          onDone={refresh}
        />
      ) : null}

      {!empty && !addMode ? (
        <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", fontStyle: "italic", color: "var(--muted)", fontSize: 12, opacity: 0.85 }}>
          arrastrá para explorar · clic en una persona para traerla al frente
        </div>
      ) : null}
    </div>
  );
}

// Shared floating-card chrome (right rail) for the detail + add panels.
function FloatingCard({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <aside
      style={{
        position: "absolute", right: 28, top: 92, width: 340, zIndex: 14,
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
      {children}
    </aside>
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

// A relationship line in the fieldbook voice: italic muted label + ink names.
function Rel({ label, names }: { label: string; names: string[] }) {
  if (!names.length) return null;
  return (
    <div style={{ fontFamily: "var(--font-body), Georgia, serif", fontSize: 13.5, lineHeight: 1.5 }}>
      <span style={{ fontStyle: "italic", color: "var(--muted)" }}>{label} </span>
      <span style={{ color: "var(--ink)" }}>{names.join(" · ")}</span>
    </div>
  );
}

function DetailCard({
  person,
  token,
  unions,
  parents,
  childNames,
  onClose,
  onDone,
}: {
  person: PersonRow;
  token: string;
  unions: Union[];
  parents: string[];
  childNames: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const f = freshness(person.updatedAt);
  const line = personLine(person);
  const [editing, setEditing] = useState(false);
  const hasRels = parents.length || unions.length || childNames.length;
  return (
    <FloatingCard onClose={onClose}>
      <div className="display" style={{ fontSize: 29, lineHeight: 1.05, color: f.fresh ? "var(--fresh)" : "var(--ink)" }}>
        {person.name}
      </div>
      {line ? (
        <div style={{ fontStyle: "italic", fontSize: 14, marginTop: 6, color: "var(--muted)" }}>{line}</div>
      ) : (
        <div style={{ fontStyle: "italic", fontSize: 14, marginTop: 6, color: "var(--muted)" }}>sin datos todavía</div>
      )}
      {f.fresh ? <div className="pl-fresh-tag" style={{ marginTop: 8 }}>agregada {f.label}</div> : null}

      {editing ? (
        <div style={{ marginTop: 16 }}>
          <EditPerson token={token} person={person} onDone={() => { setEditing(false); onDone(); }} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <>
          {hasRels ? (
            <>
              <hr style={{ border: "none", borderTop: "1px solid var(--hairline)", margin: "14px 0" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Rel label="hijo/a de" names={parents} />
                <Rel label="en pareja con" names={unions.map((u) => u.partnerName)} />
                <Rel label="madre/padre de" names={childNames} />
              </div>
            </>
          ) : null}
          <hr style={{ border: "none", borderTop: "1px solid var(--hairline)", margin: "14px 0" }} />
          <button className="pl-act" style={{ fontSize: 13 }} onClick={() => setEditing(true)}>editar sus datos</button>
          <p className="pl-meta" style={{ marginTop: 12 }}>
            para sumar familiares, tocá “Agregar familiares” arriba a la derecha y pasá el mouse sobre una persona.
          </p>
        </>
      )}
    </FloatingCard>
  );
}
