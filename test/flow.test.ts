import { describe, it, expect } from "vitest";
import { buildGraph, freshness, personLine, type PersonRow, type TreeData } from "@/lib/flow";

// buildGraph is a PURE, deterministic function — no DB, no mocks. We assert on
// STRUCTURE (node/edge counts, ids, edge kinds, source/target), never on the
// dagre-computed pixel positions, which are an implementation detail.

function person(id: string, name: string, overrides: Partial<PersonRow> = {}): PersonRow {
  return {
    id,
    name,
    birthplace: null,
    birthYear: null,
    deathYear: null,
    living: true,
    // old date so `fresh` is false unless a test overrides it
    updatedAt: new Date("2000-01-01"),
    ...overrides,
  };
}

const tree = (over: Partial<TreeData> = {}): TreeData => ({
  persons: [],
  couples: [],
  parentChild: [],
  ...over,
});

const personNodes = (g: ReturnType<typeof buildGraph>) => g.nodes.filter((n) => n.type === "person");
const unionNodes = (g: ReturnType<typeof buildGraph>) => g.nodes.filter((n) => n.type === "union");

describe("buildGraph — node/edge structure", () => {
  it("single person: 1 person node, 0 union nodes, no edges", () => {
    const g = buildGraph(tree({ persons: [person("a", "Ana")] }));
    expect(personNodes(g)).toHaveLength(1);
    expect(unionNodes(g)).toHaveLength(0);
    expect(g.edges).toHaveLength(0);
    expect(personNodes(g)[0].id).toBe("a");
  });

  it("couple: 2 person nodes, 1 union node u:c1, exactly 2 couple edges", () => {
    const g = buildGraph(
      tree({
        persons: [person("a", "Ana"), person("b", "Beto")],
        couples: [{ id: "c1", personA: "a", personB: "b" }],
      }),
    );
    expect(personNodes(g)).toHaveLength(2);
    const unions = unionNodes(g);
    expect(unions).toHaveLength(1);
    expect(unions[0].id).toBe("u:c1");
    expect(g.edges).toHaveLength(2);
    expect(g.edges.every((e) => e.data.kind === "couple")).toBe(true);
    // both partners point at the union
    expect(g.edges.map((e) => e.target).every((t) => t === "u:c1")).toBe(true);
    expect(g.edges.map((e) => e.source).sort()).toEqual(["a", "b"]);
  });

  it("couple + shared child: child hangs from the union (no direct parent edges)", () => {
    const g = buildGraph(
      tree({
        persons: [person("a", "Ana"), person("b", "Beto"), person("c", "Carla")],
        couples: [{ id: "c1", personA: "a", personB: "b" }],
        parentChild: [
          { parentId: "a", childId: "c" },
          { parentId: "b", childId: "c" },
        ],
      }),
    );
    expect(personNodes(g)).toHaveLength(3);
    expect(unionNodes(g)).toHaveLength(1);

    const coupleEdges = g.edges.filter((e) => e.data.kind === "couple");
    const parentEdges = g.edges.filter((e) => e.data.kind === "parent");
    expect(coupleEdges).toHaveLength(2);
    expect(parentEdges).toHaveLength(1);
    expect(parentEdges[0].source).toBe("u:c1");
    expect(parentEdges[0].target).toBe("c");

    // no direct a->c or b->c parent edge
    const direct = g.edges.filter(
      (e) => e.data.kind === "parent" && (e.source === "a" || e.source === "b") && e.target === "c",
    );
    expect(direct).toHaveLength(0);
  });

  it("single-parent child: no union, exactly 1 direct parent edge a->c", () => {
    const g = buildGraph(
      tree({
        persons: [person("a", "Ana"), person("c", "Carla")],
        parentChild: [{ parentId: "a", childId: "c" }],
      }),
    );
    expect(unionNodes(g)).toHaveLength(0);
    const parentEdges = g.edges.filter((e) => e.data.kind === "parent");
    expect(parentEdges).toHaveLength(1);
    expect(parentEdges[0].source).toBe("a");
    expect(parentEdges[0].target).toBe("c");
  });

  it("couple referencing a missing person is skipped: no union node, no couple edges", () => {
    const g = buildGraph(
      tree({
        persons: [person("a", "Ana")],
        couples: [{ id: "c1", personA: "a", personB: "ghost" }],
      }),
    );
    expect(unionNodes(g)).toHaveLength(0);
    expect(g.nodes.some((n) => n.id === "u:c1")).toBe(false);
    expect(g.edges.filter((e) => e.data.kind === "couple")).toHaveLength(0);
  });
});

describe("freshness", () => {
  it("a just-updated date is fresh with label 'recién'", () => {
    expect(freshness(new Date())).toEqual({ fresh: true, label: "recién" });
  });

  it("an old date is not fresh and has an empty label", () => {
    expect(freshness(new Date("2000-01-01"))).toEqual({ fresh: false, label: "" });
  });
});

describe("personLine", () => {
  it("joins birthplace and birthYear with ' · '", () => {
    expect(personLine(person("a", "Ana", { birthplace: "Roma", birthYear: 1900 }))).toBe("Roma · 1900");
  });

  it("appends a death year with ' — '", () => {
    expect(
      personLine(person("a", "Ana", { birthplace: "Roma", birthYear: 1900, deathYear: 1980 })),
    ).toBe("Roma · 1900 — 1980");
  });
});
