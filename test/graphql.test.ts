import { vi, beforeAll, afterEach, describe, it, expect } from "vitest";

// Point the code under test at the in-process PGlite db (same pattern as the suite).
vi.mock("@/db", async () => {
  const { testDb } = await import("./db");
  const schema = await import("@/db/schema");
  return { db: testDb, schema };
});

import { migrate, reset } from "./db";
import { createTree } from "@/lib/links";
import { requireTreeContext } from "@/lib/auth";
import { addPerson, addRelative, addChildToCouple, getTree } from "@/lib/persons";
import { makeYoga } from "@/graphql/server";
import { buildContext } from "@/graphql/context";
import { buildIndex, type GraphTree } from "@/graphql/treeIndex";
import type { Person } from "@/db/schema";

beforeAll(() => migrate());
afterEach(() => reset());

const yoga = makeYoga(buildContext);

async function gql(query: string, token?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  const res = await yoga.fetch("http://localhost/api/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });
  return res.json() as Promise<{ data?: any; errors?: { message: string; extensions?: any }[] }>;
}

// Build Pedro + María (couple) + their child Elsa in a fresh tree.
async function seedTree(name = "Familia Test") {
  const { treeId, token } = await createTree(name);
  const ctx = await requireTreeContext(token);
  const pedro = await addPerson(ctx, { name: "Pedro", birthYear: 1931, living: true });
  await addRelative(ctx, { person: { name: "María", living: true }, relationTo: pedro.id, relation: "partner" });
  const tree = await getTree(treeId);
  const coupleId = tree.couples[0].id;
  const elsa = await addChildToCouple(ctx, { coupleId, child: { name: "Elsa", birthYear: 1959, living: true } });
  return { treeId, token, pedroId: pedro.id, elsaId: elsa.id };
}

describe("GraphQL read layer — happy path", () => {
  it("returns the flat tree for a valid token", async () => {
    const { token } = await seedTree();
    const r = await gql(`{ tree { name people { id name } couples { id personA { id } personB { id } } parentChild { parentId childId } } }`, token);
    expect(r.errors).toBeUndefined();
    expect(r.data.tree.name).toBe("Familia Test");
    expect(r.data.tree.people).toHaveLength(3);
    expect(r.data.tree.couples).toHaveLength(1);
    expect(r.data.tree.parentChild).toHaveLength(2); // Elsa -> Pedro, Elsa -> María
  });

  it("traverses recursive parents on person(id)", async () => {
    const { token, elsaId } = await seedTree();
    const r = await gql(`{ person(id: "${elsaId}") { name parents { name } } }`, token);
    expect(r.errors).toBeUndefined();
    expect(r.data.person.name).toBe("Elsa");
    const parentNames = r.data.person.parents.map((p: { name: string }) => p.name).sort();
    expect(parentNames).toEqual(["María", "Pedro"]);
  });

  it("person(id) returns null for an id not in the tree (no global-id leak)", async () => {
    const { token } = await seedTree();
    const r = await gql(`{ person(id: "00000000-0000-0000-0000-000000000000") { name } }`, token);
    expect(r.errors).toBeUndefined();
    expect(r.data.person).toBeNull();
  });
});

describe("GraphQL read layer — auth boundary", () => {
  it("rejects a missing token as UNAUTHENTICATED (no DB hit)", async () => {
    const r = await gql(`{ tree { name } }`); // no Authorization header
    expect(r.data?.tree ?? null).toBeNull();
    expect(r.errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");
  });

  it("rejects an invalid token as UNAUTHENTICATED", async () => {
    const r = await gql(`{ tree { name } }`, "not-a-real-token");
    expect(r.errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");
  });

  it("cross-tenant: a token for tree A cannot read tree B's person", async () => {
    const a = await seedTree("Familia A");
    const b = await seedTree("Familia B");
    // Ask tree A's endpoint for a person id that only exists in tree B.
    const r = await gql(`{ person(id: "${b.pedroId}") { name } }`, a.token);
    expect(r.errors).toBeUndefined();
    expect(r.data.person).toBeNull();
  });
});

describe("GraphQL read layer — armor (query-bomb defense)", () => {
  it("rejects a query deeper than the max depth", async () => {
    const { token, elsaId } = await seedTree();
    // 10+ nested parents{...} — well past maxDepth 8.
    const deep = `{ person(id: "${elsaId}") { ${"parents { ".repeat(10)} name ${"} ".repeat(10)} } }`;
    const r = await gql(deep, token);
    expect(r.errors?.length).toBeGreaterThan(0);
    expect(r.data?.person ?? null).toBeNull();
  });
});

describe("GraphQL resolvers — pure over the preload (half-siblings, no DB)", () => {
  it("Couple.children groups children by union", async () => {
    const now = new Date();
    const mk = (id: string, name: string): Person =>
      ({ id, name, treeId: "t", birthplace: null, birthYear: null, birthMonth: null, birthDay: null,
         deathYear: null, deathMonth: null, deathDay: null, living: true, createdByLinkId: null,
         createdAt: now, updatedAt: now }) as Person;
    const fixture: GraphTree = {
      name: "F",
      persons: [mk("pedro", "Pedro"), mk("maria", "María"), mk("ana", "Ana"), mk("elsa", "Elsa"), mk("hans", "Hans")],
      couples: [
        { id: "c1", personA: "pedro", personB: "maria" },
        { id: "c2", personA: "pedro", personB: "ana" },
      ],
      parentChild: [
        { parentId: "pedro", childId: "elsa" }, { parentId: "maria", childId: "elsa" },
        { parentId: "pedro", childId: "hans" }, { parentId: "ana", childId: "hans" },
      ],
    };
    const contextValue = { treeId: "t", tree: fixture, index: buildIndex(fixture) };
    // Run through a Yoga whose context factory returns the fixture (no DB, no token) —
    // avoids a dual-`graphql`-instance realm clash from calling graphql() directly.
    const fixtureYoga = makeYoga(() => contextValue);
    const res = await fixtureYoga.fetch("http://localhost/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: `{ person(id: "pedro") { couples { personA { name } personB { name } children { name } } } }` }),
    });
    const result = (await res.json()) as { data?: any; errors?: unknown[] };
    expect(result.errors).toBeUndefined();
    const couples = result.data.person.couples as {
      personA: { name: string }; personB: { name: string }; children: { name: string }[];
    }[];
    expect(couples).toHaveLength(2);
    const withMaria = couples.find((c) => c.personB.name === "María" || c.personA.name === "María")!;
    const withAna = couples.find((c) => c.personB.name === "Ana" || c.personA.name === "Ana")!;
    expect(withMaria.children.map((c) => c.name)).toEqual(["Elsa"]);
    expect(withAna.children.map((c) => c.name)).toEqual(["Hans"]);
  });
});
