// Runs the role prompts in prompts/ against gold/ on the models in evals/models.json and writes
// evals/scoreboard.md. See evals/README.md.
//
//   node evals/run.ts                                   every role on every model (full run)
//   node evals/run.ts --role coach --model openai/gpt-oss-20b
//   node evals/run.ts --role partner,generator,coach,examiner --in-order   the nightly run: roles in priority order
//   node evals/run.ts --role coach --sample 40          quick sample: shown on the scoreboard as a sample, never admits a model
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
const resultsDir = path.join(root, "evals", "results", sampleSize ? "samples" : "");
mkdirSync(resultsDir, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
const slug = (s: string) => s.replace(/[^a-z0-9.]+/gi, "-");

// Models run in parallel (their limits are separate); roles on one model share its rate-limited queue.
// With --in-order, a model's roles run one after another in the order of --role, so the daily token cap
// is spent on the first roles first; once the cap is reached, the model's remaining roles are skipped.
const inOrder = process.argv.includes("--in-order");
const runs = models.map(async (model) => {
  const client = new RateLimitedClient(model, apiKey, path.join(root, "evals", ".cache"));
  const runRole = async (role: string): Promise<"done" | "capped" | "failed"> => {
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
        limits: result.limits ?? [],
        items: result.items,
        invalid: result.invalid,
        extra: result.extra,
        failures: result.failures,
      };
      const file = path.join(resultsDir, `${role}__${slug(model.id)}__v${prompt.version}${sampleSize ? `__n${sampleSize}` : ""}.json`);
      writeFileSync(file, JSON.stringify({ ...summary, records: result.records }, null, 2) + "\n");
      log(`${role}: ${result.metric} ${(result.score * 100).toFixed(1)}% (bar ${(result.bar * 100).toFixed(0)}%) ${result.pass ? "PASS" : "FAIL"} · ${result.items} items, ${result.invalid} invalid · ${Math.round((Date.now() - started) / 1000)} s · ${client.requests} calls, ${client.tokens} tokens, ${client.cached} from cache (model total)`);
      for (const [k, v] of Object.entries(result.extra)) log(`  ${k}: ${v}`);
      for (const f of result.failures.slice(0, 5)) log(`  ✗ ${f}`);
      return "done";
    } catch (e) {
      // A run that stops part-way is not scored: a partial score would be a number nobody measured.
      const message = (e as Error).message;
      log(`${role}: stopped, not recorded: ${message.slice(0, 160)}. Run the same command again after the cap resets: finished calls are cached in evals/.cache/.`);
      return message.startsWith("daily limit") ? "capped" : "failed";
    }
  };
  if (!inOrder) {
    await Promise.all(wantRoles.map(runRole));
    return;
  }
  for (const [i, role] of wantRoles.entries()) {
    if ((await runRole(role)) === "capped") {
      const rest = wantRoles.slice(i + 1);
      if (rest.length) console.log(`[${model.id}] daily cap reached; skipped until the next run: ${rest.join(", ")}`);
      return;
    }
  }
});
await Promise.all(runs);

writeScoreboard();
console.log("Wrote evals/scoreboard.md");
