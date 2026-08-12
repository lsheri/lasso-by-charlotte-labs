import { assembleReflectContext } from "./src/lib/reflect-context.server";
import { supabaseAdmin } from "./src/integrations/supabase/client.server";
const owner = "10e893ad-5853-41d7-95d0-ba742fb68515";
const r = await assembleReflectContext(supabaseAdmin as never, owner, {
  mode: "items",
  ids: ["a77c3de7-ae78-4c84-89fa-82e4e379ccea"],
} as never);
console.log("tier1", r.tier1Count, "tier2", r.tier2Count, "truncated", r.truncated, "reads", r.reads.length);
console.log(r.context.slice(0, 1600));
