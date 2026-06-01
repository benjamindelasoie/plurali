import dagre from "@dagrejs/dagre";

// Layered genealogy layout (React Flow's recommended approach is a real layout
// engine, not physics). We model each couple as a thin "union" junction node:
//
//     [ personA ]   [ personB ]      <- same generation (rank G)
//          \          /
//           ( union )                 <- thin junction (rank G+1)
//          /    |     \
//      [child][child][child]          <- next generation (rank G+2)
//
// dagre ranks by generation, keeps partners adjacent (both point at the union),
// centers children under the union, and minimizes crossings. It's DETERMINISTIC,
// so adding a person nudges the tree instead of re-scrambling it (the old d3-force
// problem). Single-parent children get a direct parent->child edge.

export interface PersonRow {
  id: string;
  name: string;
  birthplace: string | null;
  birthYear: number | null;
  birthMonth?: number | null;
  birthDay?: number | null;
  deathYear: number | null;
  deathMonth?: number | null;
  deathDay?: number | null;
  living: boolean;
  updatedAt: string | Date;
}
export interface Edge2 { id?: string; personA: string; personB: string }
export interface PCEdge { parentId: string; childId: string }
export interface TreeData { persons: PersonRow[]; couples: Edge2[]; parentChild: PCEdge[] }

export interface FlowNodeData {
  label: string;
  line: string;
  fresh: boolean;
  freshLabel: string;
  [key: string]: unknown;
}

const FRESH_MS = 48 * 60 * 60 * 1000;

export function freshness(updatedAt: string | Date): { fresh: boolean; label: string } {
  const age = Date.now() - new Date(updatedAt).getTime();
  if (age >= FRESH_MS) return { fresh: false, label: "" };
  if (age < 12 * 3600 * 1000) return { fresh: true, label: "recién" };
  if (age < 24 * 3600 * 1000) return { fresh: true, label: "hoy" };
  return { fresh: true, label: "ayer" };
}

export function personLine(p: PersonRow): string {
  const bits: string[] = [];
  if (p.birthplace) bits.push(p.birthplace);
  if (p.birthYear) bits.push(String(p.birthYear));
  let line = bits.join(" · ");
  if (p.deathYear) line += (line ? " — " : "") + p.deathYear;
  return line;
}

export type FlowNode =
  | { id: string; type: "person"; position: { x: number; y: number }; data: FlowNodeData }
  | { id: string; type: "union"; position: { x: number; y: number }; data: Record<string, never>; draggable: false; selectable: false };

export interface FlowGraph {
  nodes: FlowNode[];
  edges: { id: string; source: string; target: string; type: "smoothstep"; data: { kind: "couple" | "parent" } }[];
}

const NODE_W = 172;
const NODE_H = 76;
const UNION = 14;
const unionId = (coupleId: string) => `u:${coupleId}`;

export function buildGraph(tree: TreeData): FlowGraph {
  const personById = new Map(tree.persons.map((p) => [p.id, p]));

  // child -> set of its parent ids (to detect which children belong to a couple)
  const parentsOf = new Map<string, Set<string>>();
  for (const e of tree.parentChild) {
    const s = parentsOf.get(e.childId) ?? new Set<string>();
    s.add(e.parentId);
    parentsOf.set(e.childId, s);
  }

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", ranksep: 48, nodesep: 54, marginx: 48, marginy: 48, ranker: "tight-tree" });
  g.setDefaultEdgeLabel(() => ({}));

  for (const p of tree.persons) g.setNode(p.id, { width: NODE_W, height: NODE_H });

  const edges: FlowGraph["edges"] = [];
  const coveredPC = new Set<string>(); // "parent>child" routed through a union
  let ei = 0;

  for (const c of tree.couples) {
    if (!c.id || !personById.has(c.personA) || !personById.has(c.personB)) continue;
    const u = unionId(c.id);
    g.setNode(u, { width: UNION, height: UNION });
    g.setEdge(c.personA, u);
    g.setEdge(c.personB, u);
    // couple bracket: each partner down to the junction
    edges.push({ id: `cb-${ei++}-${c.personA}-${u}`, source: c.personA, target: u, type: "smoothstep", data: { kind: "couple" } });
    edges.push({ id: `cb-${ei++}-${c.personB}-${u}`, source: c.personB, target: u, type: "smoothstep", data: { kind: "couple" } });

    // children that have BOTH partners as parents hang from this union
    for (const child of tree.parentChild) {
      const ps = parentsOf.get(child.childId);
      if (child.parentId === c.personA && ps?.has(c.personB)) {
        g.setEdge(u, child.childId);
        edges.push({ id: `pc-${ei++}-${u}-${child.childId}`, source: u, target: child.childId, type: "smoothstep", data: { kind: "parent" } });
        coveredPC.add(`${c.personA}>${child.childId}`);
        coveredPC.add(`${c.personB}>${child.childId}`);
      }
    }
  }

  // parent->child edges not routed through a union (single/unknown other parent)
  for (const e of tree.parentChild) {
    if (coveredPC.has(`${e.parentId}>${e.childId}`)) continue;
    if (!personById.has(e.parentId) || !personById.has(e.childId)) continue;
    g.setEdge(e.parentId, e.childId);
    edges.push({ id: `pc-${ei++}-${e.parentId}-${e.childId}`, source: e.parentId, target: e.childId, type: "smoothstep", data: { kind: "parent" } });
  }

  dagre.layout(g);

  const nodes: FlowNode[] = [];
  for (const p of tree.persons) {
    const n = g.node(p.id);
    const f = freshness(p.updatedAt);
    nodes.push({
      id: p.id,
      type: "person",
      position: { x: Math.round((n?.x ?? 0) - NODE_W / 2), y: Math.round((n?.y ?? 0) - NODE_H / 2) },
      data: { label: p.name, line: personLine(p), fresh: f.fresh, freshLabel: f.label },
    });
  }
  for (const c of tree.couples) {
    if (!c.id) continue;
    const u = g.node(unionId(c.id));
    if (!u) continue;
    nodes.push({
      id: unionId(c.id),
      type: "union",
      position: { x: Math.round(u.x - UNION / 2), y: Math.round(u.y - UNION / 2) },
      data: {},
      draggable: false,
      selectable: false,
    });
  }

  return { nodes, edges };
}
