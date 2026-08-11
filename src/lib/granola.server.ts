/**
 * Granola direct API (https://public-api.granola.ai/v1).
 *
 * The key lives in public.connector_secrets — RLS on, zero policies — so it is
 * readable only by the service role inside these server-only helpers. It is
 * never returned to the client; the UI only ever sees a mask.
 */

const BASE = "https://public-api.granola.ai/v1";

export type GranolaNote = {
  id: string;
  title: string;
  date: string | null;
};

export class GranolaError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function maskKey(key: string): string {
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

async function call(
  key: string,
  path: string,
  attempt = 0,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });

  // Be gentle: Granola rate-limits per key, so back off once rather than hammer.
  if (response.status === 429 && attempt < 2) {
    const retryAfter = Number(response.headers.get("retry-after") ?? "2");
    await new Promise((r) => setTimeout(r, Math.min(Number.isFinite(retryAfter) ? retryAfter : 2, 10) * 1000));
    return call(key, path, attempt + 1);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GranolaError(
      response.status,
      response.status === 401 || response.status === 403
        ? "That key didn't work — check it in Granola → Settings → Connectors → API keys"
        : response.status === 429
          ? "Granola is rate-limiting this key. Wait a moment and try again."
          : `Granola returned ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
  }
  return (await response.json()) as Record<string, unknown>;
}

/** Save-time validation: the cheapest authenticated read Granola offers. */
export async function validateGranolaKey(key: string): Promise<void> {
  await call(key, "/notes?limit=1");
}

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

function rows(body: Record<string, unknown>): Record<string, unknown>[] {
  const list = body["notes"] ?? body["data"] ?? body["items"];
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
}

/** Newest first, cursor-paginated exactly as the API returns them. */
export async function listGranolaNotes(
  key: string,
  opts: { limit?: number; cursor?: string | null } = {},
): Promise<{ notes: GranolaNote[]; cursor: string | null }> {
  const params = new URLSearchParams({ limit: String(opts.limit ?? 30) });
  if (opts.cursor) params.set("cursor", opts.cursor);
  const body = await call(key, `/notes?${params.toString()}`);
  const notes = rows(body)
    .map((row) => {
      const id = pickString(row, ["id", "note_id", "document_id"]);
      if (!id) return null;
      return {
        id,
        // Titles are shown and stored verbatim — never re-worded.
        title: pickString(row, ["title", "name"]) ?? "Untitled meeting",
        date: pickString(row, ["created_at", "createdAt", "date", "started_at"]),
      };
    })
    .filter((n): n is GranolaNote => Boolean(n));
  const hasMore = body["hasMore"] === true;
  const cursor = pickString(body, ["cursor", "next_cursor"]);
  return { notes, cursor: hasMore ? cursor : null };
}

/** One note with its transcript, rendered as markdown for the work item. */
export async function fetchGranolaNote(
  key: string,
  id: string,
): Promise<{ title: string; date: string | null; markdown: string } | null> {
  const body = await call(key, `/notes/${encodeURIComponent(id)}?include=transcript`);
  const note = ((body["note"] ?? body["data"] ?? body) ?? {}) as Record<string, unknown>;
  const title = pickString(note, ["title", "name"]) ?? "Untitled meeting";
  const date = pickString(note, ["created_at", "createdAt", "date", "started_at"]);

  const summary = pickString(note, ["summary", "ai_summary", "markdown", "content", "notes"]);
  const transcriptRaw = note["transcript"];
  const transcript =
    typeof transcriptRaw === "string"
      ? transcriptRaw
      : Array.isArray(transcriptRaw)
        ? (transcriptRaw as Record<string, unknown>[])
            .map((line) => {
              const text = pickString(line, ["text", "content", "value"]);
              if (!text) return null;
              const speaker = pickString(line, ["speaker", "source", "role"]);
              return speaker ? `**${speaker}:** ${text}` : text;
            })
            .filter((l): l is string => Boolean(l))
            .join("\n\n")
        : null;

  if (!summary && !transcript) return null;

  // Granola's AI summary and the raw transcript are kept clearly apart so the
  // record shows what was said versus what a model wrote about it.
  const parts = [`# ${title}`];
  if (transcript) parts.push("## Transcript", transcript);
  if (summary) parts.push("---", "## AI notes (generated by Granola)", summary);
  return { title, date, markdown: parts.join("\n\n") };
}

/** Service-role read of the stored key; clients can never reach this table. */
export async function granolaKeyForProfile(profileId: string): Promise<{
  key: string;
  accountId: string;
} | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: account } = await supabaseAdmin
    .from("connector_accounts")
    .select("id, status")
    .eq("profile_id", profileId)
    .eq("toolkit", "granola_mcp")
    .maybeSingle();
  if (!account || account.status !== "connected") return null;
  const { data: secret } = await supabaseAdmin
    .from("connector_secrets")
    .select("api_key")
    .eq("account_id", account.id)
    .maybeSingle();
  return secret?.api_key ? { key: secret.api_key, accountId: account.id } : null;
}

export async function requireGranolaKey(profileId: string): Promise<string> {
  const found = await granolaKeyForProfile(profileId);
  if (!found) {
    throw new Error("Granola isn't connected. Add your API key on Where work lives.");
  }
  return found.key;
}
