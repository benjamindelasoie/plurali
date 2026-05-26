import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";

// One in-process Postgres for the whole test run. The code under test imports
// `db` from "@/db"; tests vi.mock("@/db") to point at this instance.
const client = new PGlite();
export const testDb = drizzle(client, { schema });

// Apply the generated migration SQL (drizzle/0000_*.sql). PGlite.exec runs a
// multi-statement SQL string; the "--> statement-breakpoint" lines are SQL comments.
let migrated = false;
export async function migrate(): Promise<void> {
  if (migrated) return;
  const here = dirname(fileURLToPath(import.meta.url));
  const drizzleDir = join(here, "..", "drizzle");
  const sqlFile = readdirSync(drizzleDir).filter((f) => f.endsWith(".sql")).sort()[0];
  const sql = readFileSync(join(drizzleDir, sqlFile), "utf8");
  await client.exec(sql);
  migrated = true;
}

/** Wipe all rows between tests (cascades from trees). */
export async function reset(): Promise<void> {
  await client.exec(`TRUNCATE trees, persons, couples, parent_child, links RESTART IDENTITY CASCADE;`);
}
