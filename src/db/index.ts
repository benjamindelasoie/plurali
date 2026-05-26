import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

// Neon serverless HTTP driver (works on Vercel Fluid/Node). Needs DATABASE_URL.
if (!process.env.DATABASE_URL) {
  // Don't crash at import in dev tooling; fail loudly only when actually used.
  console.warn("[plurali] DATABASE_URL is not set — db calls will fail until you add a Neon URL.");
}

const sql = neon(process.env.DATABASE_URL ?? "");
export const db = drizzle(sql, { schema });
export { schema };
