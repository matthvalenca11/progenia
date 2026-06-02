/**
 * wasm-to-ts.mjs
 * Converts a compiled .wasm file to a TypeScript module that exports the bytes
 * as a base64 string. This allows the WASM to be bundled directly into the JS
 * bundle without a separate network request — essential for Capacitor WebView.
 *
 * Usage: node scripts/wasm-to-ts.mjs <input.wasm> <output.ts>
 */
import { readFileSync, writeFileSync } from "fs";

const [, , input, output] = process.argv;

if (!input || !output) {
  console.error("Usage: node scripts/wasm-to-ts.mjs <input.wasm> <output.ts>");
  process.exit(1);
}

const bytes = readFileSync(input);
const b64 = bytes.toString("base64");

writeFileSync(
  output,
  `// AUTO-GENERATED — do not edit. Rebuild with: npm run build:wasm
// Source: ${input}  (${bytes.length} bytes → ${b64.length} base64 chars)
export const ULTRASOUND_WASM_B64 = "${b64}";\n`,
);

console.log(`[wasm-to-ts] ${input} (${bytes.length} bytes) → ${output}`);
