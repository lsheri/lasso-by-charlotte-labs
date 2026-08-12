import { createClient } from "@supabase/supabase-js";
import { getItemText, ITEM_TEXT_COLUMNS } from "./src/lib/item-text.server";

const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ids = [
  "980aa59e-f541-4a17-8791-a60477b71ce5",
  "36bb52f7-8403-4d4f-9747-fcd257149d93",
  "82daaa39-c109-4079-ac47-65ccc4e0c610",
];
for (const id of ids) {
  const { data } = await db.from("work_items").select(ITEM_TEXT_COLUMNS).eq("id", id).maybeSingle();
  if (!data) { console.log(id, "MISSING"); continue; }
  const r = await getItemText(db as any, data as any);
  console.log("=== ", (data as any).title, "|", r.status, r.note ?? "");
  console.log((r.text ?? "").slice(0, 300));
}
