import type { Config } from "drizzle-kit";
import { config } from "dotenv";

// drizzle-kit runs as its own process — load .env.local explicitly (Next loads it
// natively at runtime; this is just for the migration CLI).
config({ path: ".env.local" });

// plurali uses Neon (serverless Postgres) + Drizzle (DESIGN.md / eng-review T1).
// Migrations need DATABASE_URL (a Neon connection string) — see .env.example.
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
