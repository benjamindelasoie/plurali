import { z } from "zod";

// ONE Zod schema per entity, reused on client form AND server mutation (eng-review:
// no drift between what the form accepts and what the server stores).
//
// Dates are fully PARTIAL (design-review): every part optional, `name` is the only
// required field. A person can have no dates, a death year only, etc.

const yearField = z.number().int().min(1).max(3000).nullish();
const monthField = z.number().int().min(1).max(12).nullish();
const dayField = z.number().int().min(1).max(31).nullish();

export const personInput = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  birthplace: z.string().trim().max(160).nullish(),
  birthYear: yearField,
  birthMonth: monthField,
  birthDay: dayField,
  deathYear: yearField,
  deathMonth: monthField,
  deathDay: dayField,
  living: z.boolean().default(true),
});

export type PersonInput = z.infer<typeof personInput>;

// Relationship-to-anchor used by the mobile contribution form (design-review).
export const relationshipKind = z.enum(["partner", "child", "parent"]);
export type RelationshipKind = z.infer<typeof relationshipKind>;

export const addRelativeInput = z.object({
  person: personInput,
  relationTo: z.string().uuid().nullish(), // existing person this one connects to
  relation: relationshipKind.nullish(), // how they connect
});
export type AddRelativeInput = z.infer<typeof addRelativeInput>;

// Union-first child creation (handles remarriage + two parents + half-siblings).
// Add a NEW child to an existing marriage/couple — both spouses become parents, and
// "which marriage" is explicit (the chosen couple). Half-siblings fall out because a
// person's other children come from their OTHER couples.
export const addChildToCoupleInput = z.object({
  coupleId: z.string().uuid(),
  child: personInput,
});
export type AddChildToCoupleInput = z.infer<typeof addChildToCoupleInput>;

// Connect an EXISTING person as a parent of an existing child (single/unknown parent,
// or attaching the second parent after the fact). Subject to the cycle guard.
export const connectParentInput = z.object({
  parentId: z.string().uuid(),
  childId: z.string().uuid(),
});
export type ConnectParentInput = z.infer<typeof connectParentInput>;
