// A small OpenAI-compatible chat client for the evals, with Groq's free-tier limits in mind.
// The app will use the `openai` package behind the gateway (ADR 0003); the evals only need one call
// shape, so plain fetch keeps them free of a dependency the app does not have yet.
//
// Limits are per model: about 8000 tokens and 1000 requests a day at the time of writing. The client
// keeps a one-minute token window under the limit, honours retry-after on 429, and backs off on 5xx.
// The daily cap (about 200k tokens per model) is the real limit: a full run takes several days, so
// replies are cached on disk and a rerun picks up where the cap stopped it.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface ModelConfig {
  id: string;
  provider: string;
  baseUrl: string;
  free: boolean;
  tokensPerMinute: number;
  /** Extra request fields the model needs, such as reasoning_effort. */
  params?: Record<string, unknown>;
}
export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}
export interface Reply {
  content: string;
  tokens: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Roughly 3.5 characters per token for German and JSON; enough to plan the minute window.
const estimate = (messages: Message[], maxTokens: number) => Math.ceil(messages.reduce((s, m) => s + m.content.length, 0) / 3.5) + maxTokens;

export class RateLimitedClient {
  private window: Array<{ at: number; tokens: number }> = [];
  private queue: Promise<unknown> = Promise.resolve();
  requests = 0;
  tokens = 0;
  cached = 0;
  private readonly cacheDir: string;

  private readonly model: ModelConfig;
  private readonly apiKey: string;

  constructor(model: ModelConfig, apiKey: string, cacheRoot: string) {
    this.model = model;
    this.apiKey = apiKey;
    this.cacheDir = path.join(cacheRoot, model.id.replace(/[^a-z0-9.]+/gi, "-"));
  }

  /**
   * One chat completion that must return a JSON object. Calls to one model run one at a time.
   * A reply is cached under a hash of the exact request (model, params, messages, attempt), so a run
   * stopped by the daily token cap resumes where it stopped, and a prompt change re-asks everything.
   */
  async chat(messages: Message[], maxTokens: number, attempt = 0): Promise<Reply> {
    const key = createHash("sha256")
      .update(JSON.stringify([this.model.id, this.model.params ?? {}, maxTokens, attempt, messages]))
      .digest("hex");
    const file = path.join(this.cacheDir, `${key}.json`);
    if (existsSync(file)) {
      this.cached++;
      return JSON.parse(readFileSync(file, "utf8")) as Reply;
    }
    const run = this.queue.then(() => this.send(messages, maxTokens));
    this.queue = run.catch(() => undefined);
    const reply = await run;
    mkdirSync(this.cacheDir, { recursive: true });
    writeFileSync(file, JSON.stringify(reply));
    return reply;
  }

  /**
   * A call whose reply must be a JSON object the caller accepts. Like the app gateway (ARCHITECTURE.md),
   * an invalid reply is retried once; a second invalid reply is returned as undefined and counts as a failure.
   */
  async chatJson(messages: Message[], maxTokens: number, accept: (o: Record<string, unknown>) => boolean = () => true): Promise<Record<string, unknown> | undefined> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const parsed = parseJsonObject((await this.chat(messages, maxTokens, attempt)).content);
      if (parsed && accept(parsed)) return parsed;
    }
    return undefined;
  }

  private async waitForBudget(need: number) {
    // Never plan more than 90% of the minute: the estimate is rough and other runs may share the key.
    const budget = this.model.tokensPerMinute * 0.9;
    for (;;) {
      const now = Date.now();
      this.window = this.window.filter((w) => now - w.at < 60_000);
      const used = this.window.reduce((s, w) => s + w.tokens, 0);
      if (used + Math.min(need, budget) <= budget || this.window.length === 0) return;
      await sleep(60_000 - (now - this.window[0]!.at) + 50);
    }
  }

  private async send(messages: Message[], maxTokens: number): Promise<Reply> {
    const need = estimate(messages, maxTokens);
    for (let attempt = 0; ; attempt++) {
      await this.waitForBudget(need);
      const entry = { at: Date.now(), tokens: need };
      this.window.push(entry);
      let res: Response;
      try {
        res = await fetch(`${this.model.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.model.id,
            messages,
            max_tokens: maxTokens,
            temperature: 0,
            response_format: { type: "json_object" },
            ...this.model.params,
          }),
        });
      } catch (e) {
        if (attempt >= 5) throw e;
        await sleep(2000 * 2 ** attempt);
        continue;
      }
      this.requests++;
      if (res.status === 429 || res.status >= 500) {
        const body = await res.text();
        // A daily cap does not reset within a run; stop instead of waiting for hours.
        if (/per day|TPD|RPD/i.test(body) && res.status === 429) throw new Error(`daily limit reached for ${this.model.id}: ${body.slice(0, 200)}`);
        if (attempt >= 6) throw new Error(`${this.model.id}: HTTP ${res.status} after ${attempt + 1} attempts: ${body.slice(0, 200)}`);
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 + 250 : 2000 * 2 ** attempt);
        continue;
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { total_tokens?: number };
        error?: { message?: string };
      };
      if (!res.ok) {
        // Groq answers 400 json_validate_failed when the model wrote invalid JSON; that is the model's failure, not a transport one.
        const msg = json.error?.message ?? `HTTP ${res.status}`;
        if (res.status === 400 && /json/i.test(msg)) return { content: "", tokens: need };
        throw new Error(`${this.model.id}: ${msg}`);
      }
      const used = json.usage?.total_tokens ?? need;
      entry.tokens = used;
      this.tokens += used;
      return { content: json.choices?.[0]?.message?.content ?? "", tokens: used };
    }
  }
}

/** Parse a model reply as a JSON object, or undefined. The reply is untrusted text and is never run. */
export function parseJsonObject(text: string): Record<string, unknown> | undefined {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    const value: unknown = JSON.parse(text.slice(start, end + 1));
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}
