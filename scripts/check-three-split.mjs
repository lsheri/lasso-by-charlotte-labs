// Build check (Firm Brain Build Spec step 3): three.js stays out of the main bundle. Run after `bun run build`:
//   node scripts/check-three-split.mjs
// Passes only when three.js (its `__THREE__` marker) is in exactly one client chunk, the 3D firm map's, and no other
// chunk imports that chunk statically: the firm view reaches it only through a dynamic import().
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] ?? ".output/public/assets");
const chunks = readdirSync(dir).filter((name) => name.endsWith(".js"));
if (!chunks.length) {
  console.error(`No client chunks in ${dir}. Build first.`);
  process.exit(1);
}

const withThree = chunks.filter((name) =>
  readFileSync(path.join(dir, name), "utf8").includes("__THREE__"),
);
const map = withThree.filter((name) => name.startsWith("FirmMap3D-"));
const problems = [];
if (withThree.length !== 1 || map.length !== 1)
  problems.push(
    `three.js should be only in the FirmMap3D chunk, found in: ${withThree.join(", ") || "none"}`,
  );

for (const name of chunks) {
  if (name.startsWith("FirmMap3D-")) continue;
  const text = readFileSync(path.join(dir, name), "utf8");
  // A static import names the chunk after `from` or a bare `import`; a dynamic one is `import(...)`.
  if (/(?:from|import)\s*["'`]\.\/FirmMap3D-/.test(text))
    problems.push(`${name} imports the 3D map statically`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(
  `three.js is only in ${map[0]}, loaded by dynamic import. ${chunks.length} client chunks checked.`,
);
