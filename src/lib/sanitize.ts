/**
 * Every string that comes back from an AI provider, a speech recogniser or
 * LanguageTool passes through `sanitizeAiText` before it is stored or shown.
 *
 * Such text is always plain text. It is rendered through React text nodes
 * (never `dangerouslySetInnerHTML`, which lint forbids), so markup in it is
 * shown literally. What React does not stop is invisible characters that
 * change how text reads, so those are removed here.
 */

/* eslint-disable no-control-regex */
// C0 and C1 control characters, except tab and line feed.
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;
// Bidirectional overrides and isolates: they can make text read differently from its content.
const BIDI = /[\u202A-\u202E\u2066-\u2069]/g;
// Zero-width characters and the byte-order mark.
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;
/* eslint-enable no-control-regex */

export const MAX_AI_TEXT_LENGTH = 20_000;

export function sanitizeAiText(input: unknown, maxLength: number = MAX_AI_TEXT_LENGTH): string {
  if (typeof input !== "string") return "";
  const clean = input
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL, "")
    .replace(BIDI, "")
    .replace(ZERO_WIDTH, "")
    .normalize("NFC");
  // Cut on code points so a surrogate pair is never split.
  return clean.length <= maxLength ? clean : Array.from(clean).slice(0, maxLength).join("");
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** For the few sinks that are HTML rather than React, such as Anki card export. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}
