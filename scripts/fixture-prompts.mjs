// Tokenises the reference prompts so scripts/reference.py (numpy) needs no tokenizer.
import { writeFileSync } from "node:fs";
import { encode } from "gpt-tokenizer/encoding/r50k_base";

const prompts = [
  "The capital of France is",
  "When Mary and John went to the store, John gave a drink to",
  "1, 2, 3, 4,",
];
writeFileSync("tests/fixtures/prompts.json", JSON.stringify(prompts.map((text) => ({ text, ids: encode(text) })), null, 1) + "\n");
