import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next";
import firebaseRulesPlugin from "@firebase/eslint-plugin-security-rules";

export default defineConfig([
  globalIgnores([
    ".next/**",
    "out/**",
    "dist/**",
    "node_modules/**",
    "public/sw.js",
    "public/sw.js.map",
    "public/workbox-*.js",
  ]),
  {
    extends: [...next],
  },
  firebaseRulesPlugin.configs["flat/recommended"],
]);
