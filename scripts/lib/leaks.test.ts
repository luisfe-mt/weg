import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain Node module shared with the content scripts; it has no type declarations.
import { drillSentences, goldCopies, goldIndex, longestSharedRun, sentences, words } from "./leaks.mjs";

describe("words and sentences", () => {
  it("ignores case and punctuation", () => {
    expect(words("Ich fahre morgen, mit dem Zug!")).toEqual(["ich", "fahre", "morgen", "mit", "dem", "zug"]);
  });
  it("splits after end punctuation and at line breaks", () => {
    expect(sentences("Hallo. Wie geht's?\n– Gut!")).toEqual(["Hallo.", "Wie geht's?", "– Gut!"]);
  });
});

describe("gold copies", () => {
  const index = goldIndex(
    [
      { id: "gc-1", text: "Ich fahre morgen mit dem Zug nach Hamburg." },
      { id: "gc-2", text: "Ich habe eine Frage." },
    ],
    5,
  );
  it("finds a gold sentence inside a longer text, whatever the punctuation", () => {
    expect(goldCopies("Super. Ich fahre morgen mit dem Zug nach Hamburg!", index)).toEqual([
      { id: "gc-1", sentence: "Ich fahre morgen mit dem Zug nach Hamburg!" },
    ]);
  });
  it("does not flag a sentence that only shares part of a gold sentence", () => {
    expect(goldCopies("Ich fahre morgen mit dem Rad nach Hamburg.", index)).toEqual([]);
  });
  it("leaves out gold sentences below the word minimum", () => {
    expect(goldCopies("Ich habe eine Frage.", index)).toEqual([]);
  });
  it("catches a drill whose gap completes to a gold sentence", () => {
    const drill = { prompt: "Ich fahre morgen mit dem Zug nach ___. (Stadt)", answers: ["Hamburg"] };
    const hits = drillSentences(drill).flatMap((s: string) => goldCopies(s, index));
    expect(hits.map((h: { id: string }) => h.id)).toEqual(["gc-1"]);
  });
});

describe("shared run", () => {
  it("counts the longest run of identical words", () => {
    expect(longestSharedRun("Am Samstag kann ich leider nicht kommen.", "Leider kann ich am Samstag nicht.")).toBe(3);
    expect(longestSharedRun("Am Samstag kann ich leider nicht, denn ich muss arbeiten.", "Am Samstag kann ich leider nicht.")).toBe(6);
  });
  it("is zero for texts with no word in common", () => {
    expect(longestSharedRun("Guten Tag.", "Hallo du.")).toBe(0);
  });
});
