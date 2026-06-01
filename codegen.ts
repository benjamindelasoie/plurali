import type { CodegenConfig } from "@graphql-codegen/cli";

// Generates TypeScript types for the GraphQL operations from the SDL (single source
// of truth: src/graphql/schema.graphql). Run: `npm run graphql:codegen`.
const config: CodegenConfig = {
  // Schema + operations live as inlined /* GraphQL */ template strings in TS
  // (bundling-safe); codegen extracts them via graphql-tag-pluck.
  schema: "src/graphql/typeDefs.ts",
  documents: ["src/**/*.{ts,tsx}"],
  ignoreNoDocuments: true,
  generates: {
    "src/graphql/gen/types.ts": {
      plugins: ["typescript", "typescript-operations"],
      config: { skipTypename: true, scalars: { ID: "string" }, avoidOptionals: false },
    },
  },
};

export default config;
