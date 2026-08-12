import { assembleReflectContext } from "./src/lib/reflect-context.server";
import { supabaseAdmin } from "./src/integrations/supabase/client.server";
const r = await assembleReflectContext(supabaseAdmin as never, "10e893ad-5853-41d7-95d0-ba742fb68515", { mode: "items", ids: ["a77c3de7-ae78-4c84-89fa-82e4e379ccea"] } as never);
const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Lovable-API-Key": process.env.LOVABLE_API_KEY!, "X-Lovable-AIG-SDK": "fetch" },
  body: JSON.stringify({ model: "google/gemini-3.6-flash", reasoning_effort: "none", max_tokens: 300, messages: [
    { role: "system", content: "Answer only from the record. Quote verbatim lines." },
    { role: "user", content: `${r.context}\n\nQuote one exact line from the pre-pilot build items document about the support chat agent.` },
  ] }),
});
const j = await res.json();
console.log(res.status, j.choices?.[0]?.message?.content);
