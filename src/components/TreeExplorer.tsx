"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ReactFlow, Background, BackgroundVariant, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PersonNode, type AddRelation } from "./PersonNode";
import { UnionNode } from "./UnionNode";
import { AddRelative, AddPanel, EditPerson, type Union } from "./AddRelative";
import { LinkManager } from "./LinkManager";
import { buildGraph, freshness, personLine, type TreeData, type PersonRow } from "@/lib/flow";
import { matchPersons } from "@/lib/search";

const nodeTypes = { person: PersonNode, union: UnionNode };

type AddIntent = { personId: string; personName: string; relation: AddRelation };

export function TreeExplorer({
  tree,
  treeName,
  token,
  treeId,
  initialSelected = null,
  isOwner = false,
}: {
  tree: TreeData;
  treeName: string;
  token: string;
  /** The tree's id (path segment) — used to build shareable link URLs. */
  treeId: string;
  /** Anchored-link landing: focus this person on load (if they exist in the tree). */
  initialSelected?: string | null;
  /** Owner links get the quiet link-manager entry; contributors don't. */
  isOwner?: boolean;
}) {
  const router = useRouter();
  const base = useMemo(() => buildGraph(tree), [tree]);
  // Anchored landing: open on the seeded person's card — but only if they're actually
  // in the tree (a stale/foreign seed falls back to no selection, never a crash).
  const seededSelection = useMemo(
    () => (initialSelected && tree.persons.some((p) => p.id === initialSelected) ? initialSelected : null),
    [initialSelected, tree.persons],
  );
  const [selected, setSelected] = useState<string | null>(seededSelection);
  const [addMode, setAddMode] = useState(false);
  const [addIntent, setAddIntent] = useState<AddIntent | null>(null);
  const [showLinks, setShowLinks] = useState(false);
  // "Find yourself" search: a quiet contextual affordance, NOT permanent canvas
  // chrome (DESIGN.md "No chrome"). Closed at rest; expands to one .pl-input.
  const [searchOpen, setSearchOpen] = useState(false);
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

  // Center a person's card in view — reused by the seeded landing and the
  // "find yourself" search (a chosen result may be far off-screen). Cards are
  // 172×76 (flow.ts) and positions are the top-left corner, so center = +half.
  const centerPerson = useRef<((id: string) => void) | null>(null);

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
  // Picking a search result focuses that person (the existing selection logic
  // brings their card to the front; React Flow centers it) and collapses search.
  const onPickResult = useCallback((id: string) => {
    setSelected(id);
    setSearchOpen(false);
    centerPerson.current?.(id);
  }, []);
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
        {/* The ONE quiet owner-only control (DESIGN.md: no permanent canvas chrome,
            no terracotta). A vine text action that opens the link manager on demand. */}
        {isOwner && !empty ? (
          <button className="pl-act" style={{ fontSize: 13, marginTop: 6 }} onClick={() => setShowLinks(true)}>
            compartir / enlaces
          </button>
        ) : null}
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
          tocá una persona y elegí qué sumar — arriba madre/padre, al lado pareja, abajo hijo/a
        </div>
      ) : null}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(inst) => {
          fit.current = () => inst.fitView({ padding: 0.25, duration: 400 });
          centerPerson.current = (id: string) => {
            const n = inst.getNode(id);
            if (n) inst.setCenter(n.position.x + 86, n.position.y + 38, { zoom: 1, duration: 500 });
          };
          // Anchored landing: ease the seeded person's card to center on first paint,
          // so "sos vos? agregá tu familia" opens ON them rather than on the whole mesh.
          if (seededSelection) centerPerson.current(seededSelection);
        }}
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

      {/* Discreet "find yourself" search for open-link recipients (no anchor).
          A quiet text action at rest — NOT a permanent canvas search bar
          (DESIGN.md "No chrome"). Bottom-left, clear of the header, the
          "Agregar familiares" button, and the add-mode / explore hints. */}
      {!empty && !addMode ? (
        <SearchAffordance
          persons={tree.persons}
          open={searchOpen}
          onOpen={() => setSearchOpen(true)}
          onClose={() => setSearchOpen(false)}
          onPick={onPickResult}
        />
      ) : null}

      {!empty && !addMode && !searchOpen ? (
        <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", fontStyle: "italic", color: "var(--muted)", fontSize: 12, opacity: 0.85 }}>
          arrastrá para explorar · clic en una persona para traerla al frente
        </div>
      ) : null}

      {/* Owner-only link manager (mint anchored / list / revoke), opened on demand. */}
      {isOwner && showLinks ? (
        <LinkManager
          token={token}
          treeId={treeId}
          persons={tree.persons}
          defaultPersonId={selected}
          onClose={() => setShowLinks(false)}
        />
      ) : null}
    </div>
  );
}

// Discreet "find yourself" search. At rest it's a single quiet vine text action
// ("¿sos vos? buscá tu nombre"); tapping it expands a small panel with ONE
// underline input and a live result list (name + personLine). Picking a result
// focuses that person and collapses the search. Deliberately NOT a permanent
// canvas search bar (DESIGN.md "No chrome").
function SearchAffordance({
  persons,
  open,
  onOpen,
  onClose,
  onPick,
}: {
  persons: PersonRow[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  // Clear the query on every close/pick — in the event handlers, NOT an effect
  // (setState-in-effect is a lint error and an anti-pattern) — so the next
  // "¿sos vos?" starts fresh. The input autofocuses on mount (it only mounts when
  // the panel is open), so no focus effect is needed.
  const close = () => { setQuery(""); onClose(); };
  const pick = (id: string) => { setQuery(""); onPick(id); };

  // Cap results — at family scale this is plenty, and a short list stays calm.
  const results = useMemo(() => matchPersons(persons, query).slice(0, 8), [persons, query]);
  const trimmed = query.trim();

  if (!open) {
    return (
      <button
        className="pl-act"
        onClick={onOpen}
        style={{ position: "absolute", bottom: 18, left: 24, zIndex: 12, fontSize: 13.5, minHeight: 44 }}
      >
        ¿sos vos? buscá tu nombre
      </button>
    );
  }

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
      style={{
        position: "absolute", bottom: 18, left: 24, zIndex: 14, width: "min(320px, calc(100vw - 48px))",
        background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 14,
        padding: "16px 18px 12px", boxShadow: "0 30px 70px -30px rgba(34,32,27,.45)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <label htmlFor="pl-find-self" style={{ fontStyle: "italic", color: "var(--muted)", fontSize: 13 }}>
          ¿sos vos? buscá tu nombre
        </label>
        <button
          onClick={close}
          aria-label="cerrar búsqueda"
          style={{ border: "none", background: "none", color: "var(--muted)", cursor: "pointer", fontSize: 20, lineHeight: 1, minWidth: 32, minHeight: 32 }}
        >
          ×
        </button>
      </div>
      <input
        id="pl-find-self"
        autoFocus
        className="pl-input pl-input--name"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="tu nombre"
        autoComplete="off"
        style={{ marginTop: 4 }}
      />
      {trimmed ? (
        results.length ? (
          <ul style={{ listStyle: "none", margin: "10px 0 2px", padding: 0, maxHeight: 240, overflowY: "auto" }}>
            {results.map((p) => {
              const line = personLine(p);
              return (
                <li key={p.id}>
                  <button
                    onClick={() => pick(p.id)}
                    style={{
                      display: "block", width: "100%", textAlign: "left", minHeight: 44,
                      border: "none", background: "none", cursor: "pointer", padding: "8px 4px",
                      borderTop: "1px solid var(--hairline)",
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 16, color: "var(--ink)" }}>
                      {p.name}
                    </span>
                    {line ? (
                      <span style={{ display: "block", fontStyle: "italic", fontSize: 12.5, color: "var(--muted)", marginTop: 1 }}>
                        {line}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="pl-meta" style={{ marginTop: 10 }}>
            nadie con ese nombre todavía — probá con menos letras, o pedile a quien te invitó que te agregue.
          </p>
        )
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
          {/* Attribution marginalia ("many hands"): the creating link's label when set,
              else a warm fallback — NEVER a raw link id. Muted italic (.pl-meta), not
              terracotta (terracotta is freshness-only). */}
          <p className="pl-meta" style={{ marginTop: hasRels ? 10 : 12 }}>
            {person.authorLabel ? `de la mano de ${person.authorLabel}` : "agregada por la familia"}
          </p>
          <hr style={{ border: "none", borderTop: "1px solid var(--hairline)", margin: "14px 0" }} />
          <button className="pl-act" style={{ fontSize: 13 }} onClick={() => setEditing(true)}>editar sus datos</button>
          <p className="pl-meta" style={{ marginTop: 12 }}>
            para sumar familiares, tocá “Agregar familiares” arriba a la derecha y después tocá una persona.
          </p>
        </>
      )}
    </FloatingCard>
  );
}
