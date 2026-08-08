import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Désactiver les règles trop strictes de React 19 / Next.js 16
      // qui génèrent des erreurs sur le code existant
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/exhaustive-deps": "warn",

      // Désactiver la règle des apostrophes non échappées
      "react/no-unescaped-entities": "off",

      // Autoriser `any` dans le code existant
      "@typescript-eslint/no-explicit-any": "off",

      // Interface vide équivalente au supertype
      "@typescript-eslint/no-empty-object-type": "off",

      // Images <img> (les preuves utilisent des data URLs)
      "@next/next/no-img-element": "warn",
      "jsx-a11y/alt-text": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Edge Functions utilisent Deno, pas ESLint du projet
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;