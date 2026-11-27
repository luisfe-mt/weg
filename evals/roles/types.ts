import type { RateLimitedClient } from "../lib/client.ts";
import type { Prompt, Spec } from "../lib/data.ts";

export interface RoleContext {
  client: RateLimitedClient;
  prompt: Prompt;
  specs: Map<string, Spec>;
  /** Number of items for a quick sample run; undefined runs the full set. */
  sample?: number;
  log: (line: string) => void;
}

export interface RoleResult {
  role: string;
  metric: string;
  score: number;
  bar: number;
  pass: boolean;
  items: number;
  /** Items whose call failed (transport or invalid JSON); they count against the score, never skipped. */
  invalid: number;
  /** Further metrics that must stay at or under a maximum for the role to pass (Examiner false passes). */
  limits?: Array<{ metric: string; score: number; max: number }>;
  /** Secondary numbers shown next to the main metric. */
  extra: Record<string, string>;
  /** Up to ten failures with gold ids, for the scoreboard and for the next prompt change. */
  failures: string[];
  /** Every item's input id and the model's parsed output, kept for audit. */
  records: unknown[];
}
