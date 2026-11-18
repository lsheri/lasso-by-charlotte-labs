// The app stylesheet is src/styles.css plus the parts it imports from src/styles/, in cascade order.
// Tests that check a rule read the whole sheet through this, so they keep working when a rule moves between parts.
import { readFileSync } from "node:fs";

export function readStyles(): string {
  const index = readFileSync("src/styles.css", "utf8");
  const parts = [...index.matchAll(/^@import "\.\/(styles\/[^"]+\.css)";$/gm)].map((m) =>
    readFileSync(`src/${m[1]}`, "utf8"),
  );
  return [index, ...parts].join("\n");
}
