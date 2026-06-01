import type { TreeData } from "@/lib/flow";
import type { ExploreTreeQuery } from "@/graphql/gen/types";

// Server-side typed client for the PARALLEL GraphQL read path (?gql=1). Posts the
// codegen-typed ExploreTree query to /api/graphql with the capability token, and maps
// the graph-shaped result back into the flat TreeData the explore view expects.
// getTreeAction remains the default read; this is the disposable learning path.
// Inlined (not read from a .graphql file at runtime) so it bundles on Vercel; codegen
// plucks this operation via the /* GraphQL */ marker.
const EXPLORE_TREE_QUERY = /* GraphQL */ `
  query ExploreTree {
    tree {
      name
      people { id name birthplace birthYear birthMonth birthDay deathYear deathMonth deathDay living updatedAt }
      couples { id personA { id } personB { id } }
      parentChild { parentId childId }
    }
  }
`;

export async function fetchTreeViaGraphQL(
  token: string,
  origin: string,
): Promise<TreeData & { name: string }> {
  const res = await fetch(`${origin}/api/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: EXPLORE_TREE_QUERY }),
    cache: "no-store",
  });
  const json = (await res.json()) as { data?: ExploreTreeQuery; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data) throw new Error("Este enlace no es válido.");

  const t = json.data.tree;
  return {
    name: t.name,
    persons: t.people,
    couples: t.couples.map((c) => ({ id: c.id, personA: c.personA.id, personB: c.personB.id })),
    parentChild: t.parentChild.map((e) => ({ parentId: e.parentId, childId: e.childId })),
  };
}
