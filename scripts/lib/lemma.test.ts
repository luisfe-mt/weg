import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain Node module shared with the content scripts; it has no type declarations.
import { candidates, coverage, parseForms, parseFrequency, rankOf, tokenize, UNRANKED } from "./lemma.mjs";

// A tiny table in the shape of data/lemma/, so the test needs no data files.
const data = {
  lemmas: parseFrequency(
    [
      "rank\tlemma\tper_million\tpos\tgenders\tplurals",
      "1\tder\t100000\tarticle,pron\t\t",
      "2\tsein\t40000\tdet,verb\t\t",
      "3\tich\t4000\tpron\t\t",
      "4\tsie\t4000\tpron\t\t",
      "5\tgehen\t900\tverb\t\t",
      "6\tWohnung\t170\tnoun\tf\tWohnungen",
      "7\tEssen\t90\tnoun\tn\tEssen",
      "8\tessen\t55\tverb\t\t",
      "9\tanrufen\t19\tverb\t\t",
      "10\trufen\t60\tverb\t\t",
      "11\tan\t5000\tadv,prep\t\t",
      "12\tTicket\t20\tnoun\tn\tTickets",
    ].join("\n"),
  ),
  forms: parseForms(
    ["form\tlemmas", "die\tder", "ging\tgehen", "Wohnungen\tWohnung", "rufe\trufen", "angerufen\tanrufen", "ist\tsein", "esse\tessen"].join("\n"),
  ),
};

describe("lemma lookup", () => {
  it("maps a word form to its base word", () => {
    expect(candidates("ging", data)).toEqual(["gehen"]);
    expect(candidates("Wohnungen", data)).toEqual(["Wohnung"]);
  });

  it("keeps a capitalised noun apart from the verb, except at the start of a sentence", () => {
    expect(candidates("Essen", data)).toEqual(["Essen"]);
    expect(candidates("Essen", data, { sentenceInitial: true })).toEqual(["Essen", "essen"]);
    expect(candidates("Die", data, { sentenceInitial: true })).toEqual(["der"]);
  });

  it("returns nothing for a word no table knows", () => {
    expect(candidates("Krause", data)).toEqual([]);
  });

  it("ranks a lemma, falls back to lower case, and marks the rest unranked", () => {
    expect(rankOf("Wohnung", data)).toBe(6);
    expect(rankOf("Sie", data)).toBe(4);
    expect(rankOf("Aufenthaltstitel", data)).toBe(UNRANKED);
  });

  it("splits text into sentences of words", () => {
    expect(tokenize("Ich gehe. Die E-Mail ist da!")).toEqual([["Ich", "gehe"], ["Die", "E-Mail", "ist", "da"]]);
  });
});

describe("coverage", () => {
  const known = new Set(["ich", "der", "sein", "Wohnung", "anrufen"]);

  it("counts tokens whose base word is known", () => {
    const c = coverage("Ich ging. Die Wohnung ist da.", known, data);
    expect(c.tokens).toBe(6);
    expect(c.knownTokens).toBe(4);
    expect(c.unknown).toEqual(["gehen", "da"]);
  });

  it("joins a separable verb with its prefix at the end of the clause", () => {
    expect(coverage("Ich rufe die Wohnung an.", known, data).unknown).toEqual(["an"]);
    expect(coverage("Ich rufe die Wohnung.", known, data).unknown).toEqual(["rufen"]);
  });

  it("leaves names out of the count but not untaught compounds", () => {
    const c = coverage("Ich rufe Frau Krause an, das Semesterticket ist da.", known, data);
    expect(c.names).toEqual(["Frau", "Krause"]);
    expect(c.unknown).toContain("Semesterticket");
  });

  it("accepts an inflected form of a taught word the tables lack", () => {
    const withCompound = new Set([...known, "Mietvertrag"]);
    expect(coverage("Die Mietvertrags ist da.", withCompound, data).unknown).toEqual(["da"]);
  });
});
