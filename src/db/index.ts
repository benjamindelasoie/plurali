import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

// Neon serverless HTTP driver (works on Vercel Fluid/Node). LAZY by design: we do
// NOT call neon() at import. Next evaluates route modules at build time to collect
// page data, and neon() throws without a connection string — so eager init made the
// build depend on DATABASE_URL being present (it broke Preview builds). The client is
// created on first actual query instead; importing the module is always side-effect
// free, and a missing DATABASE_URL fails loudly only when the DB is really used.

type Db = NeonHttpDatabase<typeof schema>;

let instance: Db | null = null;
function getDb(): Db {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("[plurali] DATABASE_URL is not set — no database connection available.");
    instance = drizzle(neon(url), { schema });
  }
  return instance;
}

// Proxy so `db.select(...)` etc. initialize on first access, never at import.
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
