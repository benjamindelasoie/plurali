import { GraphQLError } from "graphql";
import { createSchema, createYoga, type Plugin, type YogaInitialContext } from "graphql-yoga";
import { EnvelopArmorPlugin } from "@escape.tech/graphql-armor";
import { resolvers, type GraphQLContext } from "./resolvers";
import { typeDefs } from "./typeDefs";

// Executable schema. typeDefs is an inlined string (bundling-safe on Vercel) and the
// single source of truth — codegen reads the same constant via tag-pluck.
export const schema = createSchema<GraphQLContext & YogaInitialContext>({ typeDefs, resolvers });

// Armor: the recursive Person.parents/children fields are a query-bomb vector.
// Depth alone is not enough — alias/fragment fanout can blow up a shallow query —
// so we also cap cost, aliases, and tokens. (graphql-armor wraps these as one plugin.)
const armor = EnvelopArmorPlugin({
  maxDepth: { n: 8 },
  costLimit: { maxCost: 1000, objectCost: 2, scalarCost: 1, depthCostFactor: 1.5 },
  maxAliases: { n: 20 },
  maxTokens: { n: 1200 },
  maxDirectives: { n: 20 },
  blockFieldSuggestion: { enabled: true },
});

// Log validation rejections (the query-bomb lesson must not be silent in prod).
const logRejections: Plugin = {
  onValidate() {
    return ({ valid, result }) => {
      if (!valid && Array.isArray(result) && result.length) {
        console.warn("[graphql] query rejected:", result.map((e) => e.message).join("; "));
      }
    };
  },
};

/**
 * Build a Yoga instance. Production passes the real `buildContext`; tests pass a
 * fixture context factory so resolver + armor behavior is testable without a DB.
 */
export function makeYoga(
  contextFactory: (request: Request) => Promise<GraphQLContext> | GraphQLContext,
) {
  return createYoga({
    schema,
    graphqlEndpoint: "/api/graphql",
    context: ({ request }) => contextFactory(request),
    plugins: [armor, logRejections],
    // Mask unexpected internal errors with a warm Spanish fallback, but pass through
    // intentional client-facing errors (auth UNAUTHENTICATED + validation/armor): they
    // carry `extensions` and no wrapped `originalError`. Structural check, not
    // instanceof, to avoid cross-realm GraphQLError mismatches.
    maskedErrors: {
      errorMessage: "Algo salió mal. Reintentá.",
      maskError: (error: unknown): Error => {
        const e = error as Error & { originalError?: unknown; extensions?: Record<string, unknown> };
        if (e && e.extensions !== undefined && e.originalError == null) return e;
        return new GraphQLError("Algo salió mal. Reintentá.");
      },
    },
    // GraphiQL playground only outside production.
    graphiql: process.env.NODE_ENV !== "production",
    landingPage: false,
  });
}
