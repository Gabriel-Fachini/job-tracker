import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    // Agent worktrees are full checkouts (with their own .next); lint them from inside.
    ".claude/worktrees/**",
    // Agent skills: browser-injected scripts and vendored tooling, not app code.
    ".claude/skills/**",
    ".agents/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
