import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

const noHtmlInjection =
  "Never inject HTML. Render text through React and sanitizeAiText (src/lib/sanitize.ts).";

export default tseslint.config(
  { ignores: ["dist", "src-tauri", "node_modules", "coverage"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // Security rule from CLAUDE.md: AI output is plain text and is never injected as HTML.
      "no-restricted-syntax": [
        "error",
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: noHtmlInjection },
        {
          selector: "MemberExpression[property.name=/^(innerHTML|outerHTML)$/]",
          message: noHtmlInjection,
        },
      ],
      "no-eval": "error",
      "no-implied-eval": "error",
    },
  },
  // shadcn/ui files are generated; they export variants next to components.
  { files: ["src/components/ui/**"], rules: { "react-refresh/only-export-components": "off" } },
  { files: ["scripts/**/*.mjs"], extends: [js.configs.recommended], languageOptions: { globals: globals.node } },
);
