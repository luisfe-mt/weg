import { describe, expect, it } from "vitest";
import { coachTotals, correctsLearner, flagMatches, foreignShare, overallBand, scoreCoachItem, turnProblems, wordCount } from "./metrics.ts";

describe("coach matching", () => {
  const s = "Heute ich gehe zur Uni.";
  const gold = [{ wrong: "ich gehe", right: "gehe ich" }];

  it("counts a flag on the gold span as true", () => {
    expect(flagMatches(s, { wrong: "ich gehe", right: "gehe ich" }, gold[0]!)).toBe(true);
  });
  it("counts a flag that only overlaps the gold span as true when its fix holds the gold fix", () => {
    expect(flagMatches(s, { wrong: "Heute ich gehe", right: "Heute gehe ich" }, gold[0]!)).toBe(true);
  });
  it("counts a flag at the right spot with a wrong fix as false", () => {
    const g = { wrong: "um", right: "damit" };
    const sent = "Ich spare Geld, um meine Eltern mich besuchen können.";
    expect(flagMatches(sent, { wrong: "um meine Eltern mich besuchen können", right: "um meine Eltern mich besuchen zu können" }, g)).toBe(false);
    expect(flagMatches(sent, { wrong: "um", right: "damit" }, g)).toBe(true);
  });
  it("accepts a deletion when the fix drops the word", () => {
    const g = { wrong: "sie ", right: "" };
    const sent = "Die Leute, die ich hier kenne, sie sind sehr freundlich.";
    expect(flagMatches(sent, { wrong: "kenne, sie sind", right: "kenne, sind" }, g)).toBe(true);
    expect(flagMatches(sent, { wrong: "sie sind", right: "sie ist" }, g)).toBe(false);
  });
  it("counts a flag elsewhere as false", () => {
    expect(flagMatches(s, { wrong: "zur Uni", right: "in die Uni" }, gold[0]!)).toBe(false);
  });
  it("matches a missing word when the fix adds it", () => {
    const g = { wrong: "", right: "alt" };
    expect(flagMatches("Ich bin 24 Jahre.", { wrong: "24 Jahre.", right: "24 Jahre alt." }, g)).toBe(true);
    expect(flagMatches("Ich bin 24 Jahre.", { wrong: "bin", right: "habe" }, g)).toBe(false);
  });
});

describe("coach item and totals", () => {
  it("treats any flag on a correct sentence as false and records a mustNotFlag hit", () => {
    const r = scoreCoachItem("Ich gehe heute Abend ins Kino.", [], ["heute Abend"], [{ wrong: "heute Abend", right: "heute abend" }]);
    expect(r).toMatchObject({ flags: 1, trueFlags: 0, falseFlags: 1, expected: 0, mustNotFlagHits: ["heute Abend"] });
  });
  it("computes precision over flags and recall over gold errors", () => {
    const a = scoreCoachItem("Heute ich gehe.", [{ wrong: "ich gehe", right: "gehe ich" }], [], [{ wrong: "ich gehe", right: "gehe ich" }]);
    const b = scoreCoachItem("Das ist gut.", [], [], [{ wrong: "gut", right: "schön" }]);
    const c = scoreCoachItem("Ich habe Hund.", [{ wrong: "Hund", right: "einen Hund" }], [], []);
    const t = coachTotals([a, b, c]);
    expect(t.precision).toBe(0.5);
    expect(t.recall).toBe(0.5);
    expect(t.falseFlags).toBe(1);
  });
  it("credits every gold error one flag fixes", () => {
    const gold = [{ wrong: "habe", right: "bin" }, { wrong: "", right: "alt" }];
    const r = scoreCoachItem("Ich habe 24 Jahre.", gold, [], [{ wrong: "habe 24 Jahre", right: "bin 24 Jahre alt" }]);
    expect(r).toMatchObject({ trueFlags: 1, found: 2, expected: 2 });
  });
  it("gives a silent model a precision of 0, not a free pass", () => {
    expect(coachTotals([scoreCoachItem("Ich habe Hund.", [{ wrong: "Hund", right: "einen Hund" }], [], [])]).precision).toBe(0);
  });
});

describe("examiner overall band", () => {
  const weights = { a: 0.3, b: 0.2, c: 0.25, d: 0.25 };
  it("is the weighted mean, rounded half up", () => {
    expect(overallBand({ a: 2, b: 2, c: 2, d: 2 }, weights)).toBe(2);
    expect(overallBand({ a: 3, b: 2, c: 2, d: 3 }, weights)).toBe(3); // 2.55
    expect(overallBand({ a: 1, b: 2, c: 2, d: 1 }, weights)).toBe(1); // 1.45
  });
});

describe("partner turn checks", () => {
  it("spots English and Spanish", () => {
    expect(foreignShare("Sure! Please spell your last name for me.")).toBeGreaterThan(0.3);
    expect(foreignShare("Wie ist Ihr Name, bitte?")).toBe(0);
    expect(foreignShare("Was kostet die Karte? Die ist gratis.")).toBe(0);
  });
  it("spots a correction", () => {
    expect(correctsLearner("Man sagt: einen Ausweis. Wie heißen Sie?")).toBe(true);
    expect(correctsLearner("Gut. Wie heißen Sie?")).toBe(false);
  });
  it("counts words and lists every problem", () => {
    expect(wordCount("– Guten Tag! Wie geht's?")).toBe(4);
    expect(turnProblems({ words: 20, maxWords: 12, coverage: 0.8, foreign: 0, corrects: false })).toEqual(["too-long (20/12)", "above-level (80% known)"]);
    expect(turnProblems({ words: 8, maxWords: 12, coverage: 1, foreign: 0, corrects: false })).toEqual([]);
  });
});
