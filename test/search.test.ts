import { describe, it, expect } from "vitest";
import { matchPersons, normalize } from "@/lib/search";

// matchPersons is a PURE function — no DB, no mocks. We assert on which people
// come back, never on order beyond the input order (filter preserves it).

const p = (name: string) => ({ id: name, name });

describe("normalize", () => {
  it("folds diacritics and lowercases", () => {
    expect(normalize("Müller")).toBe("muller");
    expect(normalize("Ana María")).toBe("ana maria");
    expect(normalize("  José  ")).toBe("jose");
  });
});

describe("matchPersons — accent-insensitive substring", () => {
  const people = [p("Müller"), p("Ana María"), p("Beto"), p("José Pérez")];

  it("'muller' matches 'Müller' (diacritic-insensitive)", () => {
    expect(matchPersons(people, "muller")).toEqual([p("Müller")]);
  });

  it("'ana' matches 'Ana María' (substring, case-insensitive)", () => {
    expect(matchPersons(people, "ana")).toEqual([p("Ana María")]);
  });

  it("an accented query still matches the unaccented spelling", () => {
    // recipient types 'müller', owner spelled it 'Müller' — and vice versa
    expect(matchPersons([p("Mueller")], "müller")).toEqual([]);
    expect(matchPersons([p("Müller")], "müller")).toEqual([p("Müller")]);
  });

  it("empty query returns []", () => {
    expect(matchPersons(people, "")).toEqual([]);
  });

  it("whitespace-only query returns []", () => {
    expect(matchPersons(people, "   ")).toEqual([]);
  });

  it("no match returns []", () => {
    expect(matchPersons(people, "zzz")).toEqual([]);
  });

  it("an empty roster returns [] for any query", () => {
    expect(matchPersons([], "ana")).toEqual([]);
  });
});
