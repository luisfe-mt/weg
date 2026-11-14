// Builds data/lemma/ from two downloads (ADR 0007). Run by hand when the
// sources change: `npm run build:lemma`. The output is committed; the
// downloads are not (.cache/ is git-ignored). Node only, no Python.
//
//   Wiktionary (kaikki.org extract, CC BY-SA)  -> which word form belongs to which base word
//   Leipzig Corpora, 2 x 1M sentences (CC BY)  -> how often each word form occurs
//   de-closed-class.tsv (hand-written)         -> articles and pronouns
//
// Out: de-frequency.tsv  rank, lemma, count per million, parts of speech, noun genders, plurals
//      de-forms.tsv      word form -> base word(s), for every form of a ranked lemma
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "data", "lemma");

// Pinned inputs. A changed checksum means the source was republished: review
// the diff of the output before committing it, then update the checksum here.
const KAIKKI = {
  url: "https://kaikki.org/dictionary/German/kaikki.org-dictionary-German.jsonl.gz",
  file: path.join(root, ".cache", "kaikki", "kaikki.org-dictionary-German.jsonl.gz"),
  sha256: "e16ea346863a1d0bc9e0533f83015b3847ec8b0a065ad2620b76a19bb005b520",
};
// Two corpora, averaged. News alone ranks "Prozent" and "Polizei" too high and
// has little everyday speech; the "typical" corpus is short everyday sentences
// but almost no subordinate clauses ("weil" is rare in it). Each archive is
// extracted next to itself; only the sentences file is read.
const leipzig = (name, sha256) => ({
  url: `https://downloads.wortschatz-leipzig.de/corpora/${name}.tar.gz`,
  archive: path.join(root, ".cache", "leipzig", `${name}.tar.gz`),
  file: path.join(root, ".cache", "leipzig", name, `${name}-sentences.txt`),
  sha256,
});
const LEIPZIG = [
  leipzig("deu_news_2023_1M", "392065f34be70e3612d6ef6b3edc6687b026524e57e00eef47f0528456deb1ba"),
  leipzig("deu_mixed-typical_2011_1M", "ea90ece2b164b47f5f9916d6d14a748b9ad87ab15111036b8710acc009d09505"),
];
// Lemmas kept. C1 needs roughly 8,000 to 10,000; the rest is head room for the reader.
const MAX_RANK = 15000;

const SKIP_POS = new Set([
  "character", "symbol", "punct", "prefix", "suffix", "interfix", "infix", "circumfix",
  "circumpos", "proverb", "phrase", "prep_phrase",
]);
// Entries in a form list that are labels of the table, not word forms.
const SKIP_FORM_TAGS = new Set(["table-tags", "inflection-template", "class", "auxiliary", "alternative", "obsolete", "archaic"]);
const WORD = /^\p{L}[\p{L}-]*$/u;

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file).on("data", (d) => hash.update(d)).on("end", () => resolve(hash.digest("hex"))).on("error", reject);
  });
}

async function checkInput(src, file) {
  if (!existsSync(file)) {
    console.error(`Missing ${path.relative(root, file)}.\nDownload ${src.url} to that path and run again.`);
    process.exit(1);
  }
  const got = await sha256(file);
  if (got !== src.sha256) {
    console.error(`${path.relative(root, file)}: checksum ${got} is not the pinned ${src.sha256}.`);
    process.exit(1);
  }
}

// ---- 1. Wiktionary: lemmas and their forms ---------------------------------
const lemmaPos = new Map(); // lemma -> Set(pos)
const names = new Set(); // proper names: never ranked, ignored by coverage
const formOf = new Map(); // form -> Set(lemma or intermediate form)
const nounInfo = new Map(); // lemma -> { genders:Set, plurals:Set }

const link = (form, lemma) => {
  if (!WORD.test(form) || !WORD.test(lemma) || form === lemma) return;
  let set = formOf.get(form);
  if (!set) formOf.set(form, (set = new Set()));
  set.add(lemma);
};

async function readWiktionary() {
  const lines = createInterface({ input: createReadStream(KAIKKI.file).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line) continue;
    const e = JSON.parse(line);
    if (SKIP_POS.has(e.pos) || !WORD.test(e.word)) continue;
    const senses = e.senses ?? [];
    const isLemma = senses.some((s) => !s.form_of && !(s.tags ?? []).includes("form-of"));
    for (const s of senses) for (const f of s.form_of ?? []) link(e.word, f.word);
    if (!isLemma) continue;
    if (e.pos === "name") {
      names.add(e.word);
      continue;
    }
    // Obsolete spellings ("daß") are lemma entries too; their only sense points at the modern word.
    const altOnly = senses.every((s) => s.alt_of);
    if (altOnly) {
      for (const s of senses) for (const f of s.alt_of) link(e.word, f.word);
      continue;
    }
    if (!lemmaPos.has(e.word)) lemmaPos.set(e.word, new Set());
    lemmaPos.get(e.word).add(e.pos);
    for (const f of e.forms ?? []) {
      if ((f.tags ?? []).some((t) => SKIP_FORM_TAGS.has(t))) continue;
      link(f.form, e.word);
    }
    if (e.pos === "noun") {
      let info = nounInfo.get(e.word);
      if (!info) nounInfo.set(e.word, (info = { genders: new Set(), plurals: new Set() }));
      for (const s of senses) {
        for (const t of s.tags ?? []) {
          if (t === "masculine") info.genders.add("m");
          if (t === "feminine") info.genders.add("f");
          if (t === "neuter") info.genders.add("n");
        }
      }
      for (const f of e.forms ?? []) {
        const t = f.tags ?? [];
        if (t.includes("nominative") && t.includes("plural") && WORD.test(f.form)) info.plurals.add(f.form);
      }
    }
  }
}

// A form may point at another form ("besseren" -> "besser" -> "gut"): follow to real lemmas.
function lemmasOf(form, depth = 0) {
  const out = new Set();
  if (lemmaPos.has(form)) out.add(form);
  if (depth < 3) {
    for (const target of formOf.get(form) ?? []) {
      if (lemmaPos.has(target)) out.add(target);
      else for (const l of lemmasOf(target, depth + 1)) out.add(l);
    }
  }
  return out;
}

// ---- 2. Closed classes: the hand-written table wins over Wiktionary ---------
const closed = new Map(); // form -> lemma
for (const line of readFileSync(path.join(outDir, "de-closed-class.tsv"), "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const [lemma, forms] = line.split("\t");
  for (const form of forms.split(" ")) if (!closed.has(form)) closed.set(form, lemma);
}

// Words that do not inflect. When such a word is itself a lemma ("schon",
// "bitte", "mal"), it keeps its whole count: its other reading is nearly
// always a rare verb form (schonen, bitten, malen).
const UNINFLECTED = new Set(["adv", "prep", "postp", "conj", "particle", "intj", "contraction", "pron", "det", "article", "num"]);

const lower = (w) => w.toLocaleLowerCase("de");
const isCapitalised = (w) => w[0] !== lower(w[0]);

/** Lemmas of a token in exactly this spelling. Empty for names and unknown words. */
function resolve(word) {
  if (closed.has(word)) return new Set([closed.get(word)]);
  const all = lemmasOf(word);
  if (lemmaPos.has(word)) {
    // "Essen" with a capital is the meal, not a form of "essen".
    if (isCapitalised(word)) return new Set([word]);
    if ([...lemmaPos.get(word)].some((p) => UNINFLECTED.has(p))) return new Set([word]);
  }
  return all;
}

// ---- 3. Leipzig: counts per word form ---------------------------------------
// Counted from the sentences, not from the ready-made word list, because the
// first word of a sentence needs care: "Ich" there is not the noun "das Ich".
async function readCorpus(file) {
  const mid = new Map();
  const initial = new Map();
  let total = 0;
  const lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of lines) {
    const text = line.slice(line.indexOf("\t") + 1);
    let first = true;
    for (const [word] of text.matchAll(/\p{L}+(?:-\p{L}+)*/gu)) {
      const map = first ? initial : mid;
      map.set(word, (map.get(word) ?? 0) + 1);
      first = false;
      total++;
    }
  }
  const counts = new Map();
  const add = (w, n) => n > 0 && counts.set(w, (counts.get(w) ?? 0) + n);
  for (const [word, n] of mid) {
    // Mid-sentence capitals that are no noun: "das Gute", a word after a colon.
    if (resolve(word).size || names.has(word) || !isCapitalised(word)) add(word, n);
    else add(lower(word), n);
  }
  // Share a sentence-initial word between its two spellings as the rest of the corpus uses them.
  for (const [word, n] of initial) {
    const low = lower(word);
    if (word === low) {
      add(word, n);
      continue;
    }
    const up = resolve(word).size || names.has(word) ? (mid.get(word) ?? 0) : 0;
    const down = resolve(low).size ? (mid.get(low) ?? 0) : 0;
    if (up + down === 0) add(resolve(low).size ? low : word, n);
    else {
      add(word, (n * up) / (up + down));
      add(low, (n * down) / (up + down));
    }
  }
  // Per million words, so corpora of different sizes weigh the same.
  for (const [w, n] of counts) counts.set(w, (n / total) * 1e6);
  return counts;
}

async function readCounts() {
  const counts = new Map();
  for (const src of LEIPZIG) {
    for (const [w, n] of await readCorpus(src.file)) counts.set(w, (counts.get(w) ?? 0) + n / LEIPZIG.length);
  }
  return { counts, total: 1e6 };
}

async function main() {
  await checkInput(KAIKKI, KAIKKI.file);
  for (const src of LEIPZIG) {
    await checkInput(src, src.archive);
    if (!existsSync(src.file)) {
      console.error(`Extract the sentences first:
  tar -xzf ${path.relative(root, src.archive)} -C .cache/leipzig`);
      process.exit(1);
    }
  }
  await readWiktionary();
  const { counts, total } = await readCounts();

  // Two passes. First count the forms that belong to one lemma only; then share
  // each ambiguous form ("gehört": gehören / hören) in proportion to that
  // evidence, so a rare word does not inherit the count of a common one.
  const resolved = new Map();
  const sure = new Map();
  for (const [word, n] of counts) {
    const c = resolve(word);
    if (!c.size) continue;
    resolved.set(word, c);
    if (c.size === 1) for (const l of c) sure.set(l, (sure.get(l) ?? 0) + n);
  }
  const freq = new Map();
  for (const [word, c] of resolved) {
    const n = counts.get(word);
    const weights = [...c].map((l) => (sure.get(l) ?? 0) + 1);
    const sum = weights.reduce((a, b) => a + b, 0);
    [...c].forEach((l, i) => freq.set(l, (freq.get(l) ?? 0) + (n * weights[i]) / sum));
  }

  const ranked = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"))
    .slice(0, MAX_RANK);
  const rankOf = new Map(ranked.map(([l], i) => [l, i + 1]));

  const perMillion = (n) => ((n / total) * 1e6).toFixed(n / total > 1e-5 ? 0 : 1);
  const freqLines = ["rank\tlemma\tper_million\tpos\tgenders\tplurals"];
  for (const [lemma, n] of ranked) {
    const info = nounInfo.get(lemma);
    freqLines.push(
      [
        rankOf.get(lemma),
        lemma,
        perMillion(n),
        [...(lemmaPos.get(lemma) ?? ["pron"])].sort().join(","),
        info ? [...info.genders].sort().join(",") : "",
        info ? [...info.plurals].sort().join(",") : "",
      ].join("\t"),
    );
  }

  // Every Wiktionary form of a ranked lemma, whether or not the corpus has it:
  // the reader meets forms the corpus never did. A form that is also a lemma
  // lists itself, so a reader of this file needs no second rule.
  const formLines = [];
  for (const form of new Set([...formOf.keys(), ...closed.keys()])) {
    const ls = [...resolve(form)].filter((l) => rankOf.has(l));
    if (ls.length && !(ls.length === 1 && ls[0] === form)) {
      formLines.push(`${form}\t${ls.sort((a, b) => rankOf.get(a) - rankOf.get(b)).join("|")}`);
    }
  }
  formLines.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  formLines.unshift("form\tlemmas");

  writeFileSync(path.join(outDir, "de-frequency.tsv"), freqLines.join("\n") + "\n");
  writeFileSync(path.join(outDir, "de-forms.tsv"), formLines.join("\n") + "\n");

  const covered = [...resolved.keys()].reduce((s, w) => s + counts.get(w), 0);
  console.log(`Wiktionary lemmas: ${lemmaPos.size}, names: ${names.size}, forms: ${formOf.size}.`);
  console.log(`Corpus tokens resolved to a lemma: ${((covered / total) * 100).toFixed(1)}%.`);
  console.log(`Wrote ${ranked.length} lemmas and ${formLines.length - 1} forms to ${path.relative(root, outDir)}.`);
}

await main();
