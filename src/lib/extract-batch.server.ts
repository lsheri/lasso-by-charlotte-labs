import {
  EXTRACT_MODEL,
  EXTRACT_SYSTEM_PROMPT,
  extractUserPrompt,
  parseExtractJson,
  prepareExtract,
  writeExtract,
  type PreparedExtract,
} from "@/lib/extract.server";
import { reportAiHealth } from "@/lib/ai-health.server";

/**
 * Extracts written in bulk are not latency sensitive, so they go through the
 * Batch API at half price. Pending batch ids live in orgs.settings, and a
 * public poll route drains them. Anything that fails here falls back to the
 * synchronous path, so an extract is never simply lost.
 */

const OPENAI = "https://api.openai.com/v1";

function apiKey(): string {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) throw new Error("Missing OPENAI_API_KEY");
  return key;
}

type PendingBatch = { id: string; submitted_at: string; count: number };

async function readPending(orgId: string): Promise<PendingBatch[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("orgs").select("settings").eq("id", orgId).maybeSingle();
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const list = settings["extract_batches"];
  return Array.isArray(list) ? (list as PendingBatch[]) : [];
}

async function writePending(orgId: string, batches: PendingBatch[]): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("orgs").select("settings").eq("id", orgId).maybeSingle();
  const settings = { ...((data?.settings ?? {}) as Record<string, unknown>) };
  if (batches.length === 0) delete settings["extract_batches"];
  else settings["extract_batches"] = batches;
  await supabaseAdmin
    .from("orgs")
    .update({ settings: settings as never })
    .eq("id", orgId);
}

/**
 * Submits one batch of extracts. Returns the ids it could not batch, so the
 * caller can run those synchronously.
 */
export async function submitExtractBatch(workItemIds: string[]): Promise<string[]> {
  const prepared: PreparedExtract[] = [];
  for (const id of workItemIds) {
    const one = await prepareExtract(id).catch(() => null);
    if (one && !one.unchanged) prepared.push(one);
  }
  if (prepared.length === 0) return [];

  const orgId = prepared[0]!.item.org_id;
  const sameOrg = prepared.filter((p) => p.item.org_id === orgId);
  const otherOrg = prepared.filter((p) => p.item.org_id !== orgId).map((p) => p.item.id);

  const jsonl = sameOrg
    .map((p) =>
      JSON.stringify({
        custom_id: p.item.id,
        method: "POST",
        url: "/v1/chat/completions",
        body: {
          model: EXTRACT_MODEL,
          max_tokens: 700,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: EXTRACT_SYSTEM_PROMPT },
            { role: "user", content: extractUserPrompt(p.item.title, p.text) },
          ],
        },
      }),
    )
    .join("\n");

  try {
    const form = new FormData();
    form.append("purpose", "batch");
    form.append("file", new Blob([jsonl], { type: "application/jsonl" }), "extracts.jsonl");
    const upload = await fetch(`${OPENAI}/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}` },
      body: form,
    });
    if (!upload.ok) throw new Error(`file upload ${upload.status}`);
    const file = (await upload.json()) as { id: string };

    const created = await fetch(`${OPENAI}/batches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        input_file_id: file.id,
        endpoint: "/v1/chat/completions",
        completion_window: "24h",
      }),
    });
    if (!created.ok) throw new Error(`batch create ${created.status}`);
    const batch = (await created.json()) as { id: string };

    const pending = await readPending(orgId);
    pending.push({
      id: batch.id,
      submitted_at: new Date().toISOString(),
      count: sameOrg.length,
    });
    await writePending(orgId, pending);
    return otherOrg;
  } catch (e) {
    await reportAiHealth({
      errorClass: "batch_failed",
      surface: "extract_batch",
      orgId,
      note: (e as Error).message.slice(0, 120),
    });
    return workItemIds;
  }
}

/** Drains every finished batch across every org. Safe to call repeatedly. */
export async function drainExtractBatches(): Promise<{ written: number; pending: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: orgs } = await supabaseAdmin.from("orgs").select("id, settings");
  let written = 0;
  let stillPending = 0;

  for (const org of orgs ?? []) {
    const settings = (org.settings ?? {}) as Record<string, unknown>;
    const list = settings["extract_batches"];
    if (!Array.isArray(list) || list.length === 0) continue;

    const keep: PendingBatch[] = [];
    for (const entry of list as PendingBatch[]) {
      try {
        const res = await fetch(`${OPENAI}/batches/${entry.id}`, {
          headers: { Authorization: `Bearer ${apiKey()}` },
        });
        if (!res.ok) throw new Error(`batch fetch ${res.status}`);
        const batch = (await res.json()) as {
          status: string;
          output_file_id?: string | null;
        };
        if (batch.status === "in_progress" || batch.status === "validating" || batch.status === "finalizing") {
          keep.push(entry);
          stillPending += 1;
          continue;
        }
        if (batch.status !== "completed" || !batch.output_file_id) {
          await reportAiHealth({
            errorClass: "batch_failed",
            surface: "extract_batch",
            orgId: org.id,
            note: `batch ${entry.id} ${batch.status}`,
          });
          continue;
        }

        const contents = await fetch(`${OPENAI}/files/${batch.output_file_id}/content`, {
          headers: { Authorization: `Bearer ${apiKey()}` },
        });
        const body = await contents.text();
        for (const raw of body.split("\n")) {
          if (!raw.trim()) continue;
          const row = JSON.parse(raw) as {
            custom_id?: string;
            response?: { body?: { choices?: { message?: { content?: string } }[] } };
          };
          const workItemId = row.custom_id;
          if (!workItemId) continue;
          const fields = parseExtractJson(
            row.response?.body?.choices?.[0]?.message?.content ?? null,
          );
          if (!fields) continue;
          const prepared = await prepareExtract(workItemId).catch(() => null);
          if (!prepared) continue;
          if (await writeExtract(prepared, fields)) written += 1;
        }
      } catch (e) {
        keep.push(entry);
        stillPending += 1;
        console.error("[extract-batch] drain failed:", (e as Error).message);
      }
    }
    await writePending(org.id, keep);
  }

  return { written, pending: stillPending };
}
