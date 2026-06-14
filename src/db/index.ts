import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema";

// Neon serverless Pool driver (works on Vercel Fluid/Node; runtime = "nodejs" gives
// us a global WebSocket on Node 22). The Pool driver — unlike neon-http — supports
// interactive db.transaction(), which the multi-write person mutations rely on to be
// atomic. LAZY by design: we do NOT construct the Pool at import. Next evaluates route
// modules at build time to collect page data, and we don't want the build to depend on
// DATABASE_URL being present (eager init broke Preview builds). The client is created
// on first actual query instead; importing the module is always side-effect free, and
// a missing DATABASE_URL fails loudly only when the DB is really used.

type Db = NeonDatabase<typeof schema>;

let instance: Db | null = null;
function getDb(): Db {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("[plurali] DATABASE_URL is not set — no database connection available.");
    instance = drizzle(new Pool({ connectionString: url }), { schema });
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
