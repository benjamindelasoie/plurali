import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

/*
  plurali data model — a GRAPH, not a parent->child tree (eng-review).
  Two parents per child, remarriage, half-siblings are all representable.
  V0 collaboration is whole-tree edit via capability links (Option C):
  NO per-branch scope. Branch-scoped stewardship is a V1 concern.

      trees ─┬─< persons >─┬─< couples (person_a, person_b)
             │             └─< parent_child (parent_id, child_id)   [2 rows = 2 parents]
             └─< links (owner | open | anchored)  -- the capability URLs

  Dates are PARTIAL: year/month/day each optional (you rarely know an 1860s
  ancestor's exact birthday). `name` is the only required person field.
  Attribution: every row stamps created_by_link_id + timestamps (cheap now,
  painful to retrofit — eng-review TODO).
*/

export const linkKind = pgEnum("link_kind", ["owner", "open", "anchored"]);

export const trees = pgTable("trees", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Capability links. The raw token lives ONLY in the URL; we store its SHA-256 hash.
// kind: owner (full control, mint/revoke), open (one WhatsApp join link),
//        anchored (per-person link — seedPersonId sets the entry point, NOT edit scope).
// revokable: revokedAt != null => 403. (Expiry is V1.)
export const links = pgTable(
  "links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    treeId: uuid("tree_id").notNull().references(() => trees.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    kind: linkKind("kind").notNull(),
    seedPersonId: uuid("seed_person_id"), // anchored links: where the recipient lands
    label: text("label"), // e.g. "para los primos Méndez"
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // hit on every mutation via the token guard — keep it indexed (perf review).
    tokenHashIdx: index("links_token_hash_idx").on(t.tokenHash),
    treeIdx: index("links_tree_idx").on(t.treeId),
  }),
);

export const persons = pgTable(
  "persons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    treeId: uuid("tree_id").notNull().references(() => trees.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // the only required field
    birthplace: text("birthplace"),
    // partial dates — each part optional
    birthYear: integer("birth_year"),
    birthMonth: integer("birth_month"),
    birthDay: integer("birth_day"),
    deathYear: integer("death_year"),
    deathMonth: integer("death_month"),
    deathDay: integer("death_day"),
    living: boolean("living").default(true).notNull(),
    // attribution (cheap early slice — eng-review TODO #2)
    createdByLinkId: uuid("created_by_link_id").references(() => links.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    treeIdx: index("persons_tree_idx").on(t.treeId),
  }),
);

// A union/marriage edge (undirected; store as ordered pair for dedup convenience).
export const couples = pgTable(
  "couples",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    treeId: uuid("tree_id").notNull().references(() => trees.id, { onDelete: "cascade" }),
    personA: uuid("person_a").notNull().references(() => persons.id, { onDelete: "cascade" }),
    personB: uuid("person_b").notNull().references(() => persons.id, { onDelete: "cascade" }),
    createdByLinkId: uuid("created_by_link_id").references(() => links.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ treeIdx: index("couples_tree_idx").on(t.treeId) }),
);

// One row per parent->child edge. A child with two parents = two rows.
export const parentChild = pgTable(
  "parent_child",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    treeId: uuid("tree_id").notNull().references(() => trees.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    childId: uuid("child_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    createdByLinkId: uuid("created_by_link_id").references(() => links.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    treeIdx: index("parent_child_tree_idx").on(t.treeId),
    childIdx: index("parent_child_child_idx").on(t.childId),
  }),
);

export type Person = typeof persons.$inferSelect;
export type NewPerson = typeof persons.$inferInsert;
export type Link = typeof links.$inferSelect;
