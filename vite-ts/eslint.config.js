import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "test-results", "playwright-report", "src/credits/credits.js"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
