// Single source of truth for the GraphQL schema. Kept as an inlined TS string (not
// a .graphql file read at runtime) so it's always bundled into the Vercel function —
// runtime fs.readFileSync of src/ files is not traced into the serverless output.
// codegen reads this same constant via graphql-tag-pluck (the /* GraphQL */ marker).
export const typeDefs = /* GraphQL */ `
  """
  plurali GraphQL read layer (learning slice, runs PARALLEL to getTreeAction).
  A family tree is a graph, so the schema's type graph mirrors the domain:
  a Person traverses to its parents / children / couples. The capability token
  scopes every query to ONE tree; resolvers are pure over a single getTree
  preload (no per-field DB reads), so cross-tenant access can't happen.
  Read-only by design — mutations stay as Next Server Actions.
  """
  type Query {
    "The whole tree the capability token grants access to."
    tree: Tree!
    "A single person within the authorized tree, or null if the id isn't in it."
    person(id: ID!): Person
  }

  type Tree {
    name: String!
    people: [Person!]!
    couples: [Couple!]!
    parentChild: [ParentChildEdge!]!
  }

  type Person {
    id: ID!
    name: String!
    birthplace: String
    birthYear: Int
    birthMonth: Int
    birthDay: Int
    deathYear: Int
    deathMonth: Int
    deathDay: Int
    living: Boolean!
    "ISO timestamp; drives the drying-ink freshness signal."
    updatedAt: String!
    "True when updated within the last 48h (terracotta in the UI)."
    fresh: Boolean!
    "Recursive traversal — the reason a family tree fits GraphQL."
    parents: [Person!]!
    children: [Person!]!
    couples: [Couple!]!
  }

  "A union/marriage. Named Couple (NOT Union — that collides with the GraphQL union keyword)."
  type Couple {
    id: ID!
    personA: Person!
    personB: Person!
    "Children of this specific union (both partners are parents) — half-siblings fall out naturally."
    children: [Person!]!
  }

  type ParentChildEdge {
    parentId: ID!
    childId: ID!
  }
`;
