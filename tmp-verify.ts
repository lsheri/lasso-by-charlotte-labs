import { ensureExtract } from "./src/lib/extract.server";
for (const id of process.argv.slice(2)) console.log(id, await ensureExtract(id));
