import { describe, expect, it } from "vitest";
import { escapeHtml, sanitizeAiText } from "./sanitize";

describe("sanitizeAiText", () => {
  it("keeps German text, tabs and line breaks", () => {
    expect(sanitizeAiText("Grüß dich!\n\tWie geht's?")).toBe("Grüß dich!\n\tWie geht's?");
  });

  it("leaves markup as literal text for React to escape", () => {
    expect(sanitizeAiText('<img src=x onerror="alert(1)">')).toBe('<img src=x onerror="alert(1)">');
  });

  it("removes control, bidi-override and zero-width characters", () => {
    expect(sanitizeAiText("a\u0000b\u001Bc\u202Ed\u200Be\uFEFF")).toBe("abcde");
  });

  it("normalises line endings and composes characters", () => {
    expect(sanitizeAiText("a\r\nb\rc")).toBe("a\nb\nc");
    // "u" followed by a combining diaeresis becomes the single letter u-umlaut.
    const composed = sanitizeAiText(`u${String.fromCharCode(0x308)}ber`);
    expect(composed).toHaveLength(4);
    expect(composed.charCodeAt(0)).toBe(0xfc);
  });

  it("returns an empty string for anything that is not a string", () => {
    expect(sanitizeAiText(undefined)).toBe("");
    expect(sanitizeAiText({ text: "x" })).toBe("");
  });

  it("truncates without splitting a surrogate pair", () => {
    expect(sanitizeAiText("ab😀cd", 3)).toBe("ab😀");
  });
});

describe("escapeHtml", () => {
  it("escapes the five significant characters", () => {
    expect(escapeHtml(`<a href="x">Tom & 'Ann'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Ann&#39;&lt;/a&gt;",
    );
  });
});
