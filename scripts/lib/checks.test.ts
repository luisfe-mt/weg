import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain Node module shared with the content scripts; it has no type declarations.
import { bandFloor, pluralAccepted } from "./checks.mjs";

describe("plural check", () => {
  const entry = { plurals: ["Rettungswägen"] };
  const variants = [{ lemma: "Rettungswagen", plurals: ["Rettungswagen"], note: "unchanged plural is standard" }];

  it("rejects a plural Wiktionary lacks when no variant is listed", () => {
    expect(pluralAccepted("Rettungswagen", "Rettungswagen", entry, [])).toBe(false);
  });
  it("accepts it when the variants file lists it for that lemma", () => {
    expect(pluralAccepted("Rettungswagen", "Rettungswagen", entry, variants)).toBe(true);
  });
  it("does not apply a variant to another lemma", () => {
    expect(pluralAccepted("Krankenwagen", "Rettungswagen", entry, variants)).toBe(false);
  });
  it("still accepts what Wiktionary lists", () => {
    expect(pluralAccepted("Rettungswägen", "Rettungswagen", entry, [])).toBe(true);
  });
});

describe("band floor", () => {
  const bands = { minShare: 0.8, minShareBySublevel: { "B2.1": 0.7 } };
  it("uses the default share", () => expect(bandFloor(bands, "B1.2")).toBe(0.8));
  it("uses the sublevel override", () => expect(bandFloor(bands, "B2.1")).toBe(0.7));
});
