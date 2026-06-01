/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

/** A union/marriage. Named Couple (NOT Union — that collides with the GraphQL union keyword). */
export type Couple = {
  /** Children of this specific union (both partners are parents) — half-siblings fall out naturally. */
  children: Array<Person>;
  id: Scalars['ID']['output'];
  personA: Person;
  personB: Person;
};

export type ParentChildEdge = {
  childId: Scalars['ID']['output'];
  parentId: Scalars['ID']['output'];
};

export type Person = {
  birthDay?: Maybe<Scalars['Int']['output']>;
  birthMonth?: Maybe<Scalars['Int']['output']>;
  birthYear?: Maybe<Scalars['Int']['output']>;
  birthplace?: Maybe<Scalars['String']['output']>;
  children: Array<Person>;
  couples: Array<Couple>;
  deathDay?: Maybe<Scalars['Int']['output']>;
  deathMonth?: Maybe<Scalars['Int']['output']>;
  deathYear?: Maybe<Scalars['Int']['output']>;
  /** True when updated within the last 48h (terracotta in the UI). */
  fresh: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  living: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  /** Recursive traversal — the reason a family tree fits GraphQL. */
  parents: Array<Person>;
  /** ISO timestamp; drives the drying-ink freshness signal. */
  updatedAt: Scalars['String']['output'];
};

/**
 * plurali GraphQL read layer (learning slice, runs PARALLEL to getTreeAction).
 * A family tree is a graph, so the schema's type graph mirrors the domain:
 * a Person traverses to its parents / children / couples. The capability token
 * scopes every query to ONE tree; resolvers are pure over a single getTree
 * preload (no per-field DB reads), so cross-tenant access can't happen.
 * Read-only by design — mutations stay as Next Server Actions.
 */
export type Query = {
  /** A single person within the authorized tree, or null if the id isn't in it. */
  person?: Maybe<Person>;
  /** The whole tree the capability token grants access to. */
  tree: Tree;
};


/**
 * plurali GraphQL read layer (learning slice, runs PARALLEL to getTreeAction).
 * A family tree is a graph, so the schema's type graph mirrors the domain:
 * a Person traverses to its parents / children / couples. The capability token
 * scopes every query to ONE tree; resolvers are pure over a single getTree
 * preload (no per-field DB reads), so cross-tenant access can't happen.
 * Read-only by design — mutations stay as Next Server Actions.
 */
export type QueryPersonArgs = {
  id: Scalars['ID']['input'];
};

export type Tree = {
  couples: Array<Couple>;
  name: Scalars['String']['output'];
  parentChild: Array<ParentChildEdge>;
  people: Array<Person>;
};

export type ExploreTreeQueryVariables = Exact<{ [key: string]: never; }>;


export type ExploreTreeQuery = { tree: { name: string, people: Array<{ id: string, name: string, birthplace: string | null, birthYear: number | null, birthMonth: number | null, birthDay: number | null, deathYear: number | null, deathMonth: number | null, deathDay: number | null, living: boolean, updatedAt: string }>, couples: Array<{ id: string, personA: { id: string }, personB: { id: string } }>, parentChild: Array<{ parentId: string, childId: string }> } };
