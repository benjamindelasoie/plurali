import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceX,
  forceY,
  forceCollide,
  type SimulationNodeDatum,
} from "d3-force";

// Pure transform: tree rows (persons + couple/parent_child edges) -> React Flow
// nodes + edges, positioned by a d3-force run with light generational gravity
// (elders float up). Runs synchronously (family-scale data is tiny). Production
// can hand this to React Flow's live d3-force; this gives a stable seed layout.

export interface PersonRow {
  id: string;
  name: string;
  birthplace: string | null;
  birthYear: number | null;
  deathYear: number | null;
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

// generational depth via fixed-point over the DAG (tiny data -> cheap)
function generations(persons: PersonRow[], pc: PCEdge[]): Map<string, number> {
  const gen = new Map<string, number>(persons.map((p) => [p.id, 0]));
  for (let pass = 0; pass < persons.length + 1; pass++) {
    let changed = false;
    for (const e of pc) {
      const g = Math.max(gen.get(e.childId) ?? 0, (gen.get(e.parentId) ?? 0) + 1);
      if (g !== gen.get(e.childId)) { gen.set(e.childId, g); changed = true; }
    }
    if (!changed) break;
  }
  return gen;
}

type SimNode = SimulationNodeDatum & { id: string; gen: number };

export interface FlowGraph {
  nodes: { id: string; type: "person"; position: { x: number; y: number }; data: FlowNodeData }[];
  edges: { id: string; source: string; target: string; type: "straight"; data: { kind: "couple" | "parent" } }[];
}

export function buildGraph(tree: TreeData): FlowGraph {
  const gen = generations(tree.persons, tree.parentChild);
  const GEN_GAP = 150;

  const sim: SimNode[] = tree.persons.map((p) => ({ id: p.id, gen: gen.get(p.id) ?? 0 }));
  const byId = new Map(sim.map((n) => [n.id, n]));

  const links = [
    ...tree.parentChild.map((e) => ({ source: e.parentId, target: e.childId })),
    ...tree.couples.map((e) => ({ source: e.personA, target: e.personB })),
  ].filter((l) => byId.has(l.source as string) && byId.has(l.target as string));

  forceSimulation(sim)
    .force("charge", forceManyBody().strength(-520))
    .force("link", forceLink(links).id((d) => (d as SimNode).id).distance(130).strength(0.4))
    .force("y", forceY<SimNode>((d) => d.gen * GEN_GAP).strength(0.45)) // generational gravity
    .force("x", forceX(0).strength(0.04))
    .force("collide", forceCollide(78))
    .stop()
    .tick(360);

  const persons = new Map(tree.persons.map((p) => [p.id, p]));
  return {
    nodes: sim.map((n) => {
      const p = persons.get(n.id)!;
      const f = freshness(p.updatedAt);
      return {
        id: n.id,
        type: "person" as const,
        position: { x: Math.round(n.x ?? 0), y: Math.round(n.y ?? 0) },
        data: { label: p.name, line: personLine(p), fresh: f.fresh, freshLabel: f.label },
      };
    }),
    edges: [
      ...tree.parentChild.map((e, i) => ({
        id: `pc-${i}-${e.parentId}-${e.childId}`,
        source: e.parentId, target: e.childId, type: "straight" as const, data: { kind: "parent" as const },
      })),
      ...tree.couples.map((e, i) => ({
        id: `cp-${i}-${e.personA}-${e.personB}`,
        source: e.personA, target: e.personB, type: "straight" as const, data: { kind: "couple" as const },
      })),
    ],
  };
}
