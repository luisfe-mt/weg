// Look words up in data/lemma/ from the command line. For content writers.
//   node scripts/lemma.mjs Wohnung ging anrufen     base word, rank, gender, plural
//   node scripts/lemma.mjs --band 201 400           the lemmas in a rank window
import process from "node:process";
import { candidates, loadLemmaData, UNRANKED } from "./lib/lemma.mjs";

const data = loadLemmaData();
const args = process.argv.slice(2);
const describe = (lemma) => {
  const e = data.lemmas.get(lemma);
  return [e.rank, lemma, e.pos.join(","), e.genders.join(","), e.plurals.join(",")].join("\t");
};

if (args[0] === "--band") {
  const [from, to] = [Number(args[1]), Number(args[2])];
  for (const [lemma, e] of data.lemmas) if (e.rank >= from && e.rank <= to) console.log(describe(lemma));
} else {
  for (const word of args) {
    const found = candidates(word, data, { sentenceInitial: true });
    if (found.length === 0) console.log(`${UNRANKED}\t${word}\tnot in the list: use frequencyRank ${UNRANKED}`);
    for (const lemma of found) console.log(describe(lemma) + (lemma === word ? "" : `\t(from ${word})`));
  }
}
