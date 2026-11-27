// Runs the role prompts in prompts/ against gold/ on the models in evals/models.json and writes
// evals/scoreboard.md. See evals/README.md.
//
//   node evals/run.ts                                   every role on every model (full run)
//   node evals/run.ts --role coach --model openai/gpt-oss-20b
//   node evals/run.ts --role coach --sample 40          quick sample: written to evals/.runs/, not the scoreboard
//
// The key comes from GROQ_API_KEY (environment or the git-ignored .env). It is never printed or written.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { RateLimitedClient, type ModelConfig } from "./lib/client.ts";
import { loadPrompt, loadSpecs, root } from "./lib/data.ts";
import { runCoach } from "./roles/coach.ts";
import { runExaminer } from "./roles/examiner.ts";
import { runGenerator } from "./roles/generator.ts";
import { runPartner } from "./roles/partner.ts";
import type { RoleContext, RoleResult } from "./roles/types.ts";
import { writeScoreboard, type Summary } from "./scoreboard.ts";

const ROLES: Record<string, (ctx: RoleContext) => Promise<RoleResult>> = {
  coach: runCoach,
  generator: runGenerator,
  examiner: runExaminer,
  partner: runPartner,
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const envFile = path.join(root, ".env");
if (!process.env.GROQ_API_KEY && existsSync(envFile)) process.loadEnvFile(envFile);
const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.error("GROQ_API_KEY is not set (environment or .env).");
  process.exit(1);
}

const config = JSON.parse(readFileSync(path.join(root, "evals", "models.json"), "utf8")) as { models: ModelConfig[] };
const wantModels = arg("model")?.split(",");
const wantRoles = arg("role")?.split(",") ?? Object.keys(ROLES);
const sampleSize = arg("sample") ? Number(arg("sample")) : undefined;
const models = config.models.filter((m) => !wantModels || wantModels.includes(m.id));
for (const r of wantRoles) if (!ROLES[r]) throw new Error(`unknown role ${r}`);
if (!models.length) throw new Error(`no model matches ${wantModels?.join(",")}`);

const specs = loadSpecs();
const resultsDir = path.join(root, "evals", sampleSize ? ".runs" : "results");
mkdirSync(resultsDir, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
const slug = (s: string) => s.replace(/[^a-z0-9.]+/gi, "-");

// Models run in parallel (their limits are separate); roles on one model share its rate-limited queue.
const runs = models.flatMap((model) => {
  const client = new RateLimitedClient(model, apiKey);
  return wantRoles.map(async (role) => {
    const prompt = loadPrompt(role);
    const log = (line: string) => console.log(`[${model.id}] ${line}`);
    const started = Date.now();
    try {
      const result = await ROLES[role]!({ client, prompt, specs, sample: sampleSize, log });
      const summary: Summary = {
        role,
        model: model.id,
        promptVersion: prompt.version,
        date: today,
        sample: sampleSize ?? null,
        metric: result.metric,
        score: result.score,
        bar: result.bar,
        pass: result.pass,
        items: result.items,
        invalid: result.invalid,
        extra: result.extra,
        failures: result.failures,
      };
      const file = path.join(resultsDir, `${role}__${slug(model.id)}__v${prompt.version}.json`);
      writeFileSync(file, JSON.stringify({ ...summary, records: result.records }, null, 2) + "\n");
      log(`${role}: ${result.metric} ${(result.score * 100).toFixed(1)}% (bar ${(result.bar * 100).toFixed(0)}%) ${result.pass ? "PASS" : "FAIL"} · ${result.items} items, ${result.invalid} invalid · ${Math.round((Date.now() - started) / 1000)} s`);
      for (const [k, v] of Object.entries(result.extra)) log(`  ${k}: ${v}`);
      for (const f of result.failures.slice(0, 5)) log(`  ✗ ${f}`);
    } catch (e) {
      // A run that stops part-way is not scored: a partial score would be a number nobody measured.
      log(`${role}: stopped, not recorded: ${(e as Error).message}`);
    }
  });
});
await Promise.all(runs);

if (!sampleSize) {
  writeScoreboard();
  console.log("Wrote evals/scoreboard.md");
}
