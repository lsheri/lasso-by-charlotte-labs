/**
 * Granola direct API (https://public-api.granola.ai/v1).
 *
 * The key lives in public.connector_secrets, RLS on, zero policies, so it is
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

async function call(key: string, path: string, attempt = 0): Promise<Record<string, unknown>> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });

  // Be gentle: Granola rate-limits per key, so back off once rather than hammer.
  if (response.status === 429 && attempt < 2) {
    const retryAfter = Number(response.headers.get("retry-after") ?? "2");
    await new Promise((r) =>
      setTimeout(r, Math.min(Number.isFinite(retryAfter) ? retryAfter : 2, 10) * 1000),
    );
    return call(key, path, attempt + 1);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GranolaError(
      response.status,
      response.status === 401 || response.status === 403
        ? "That key didn't work, check it in Granola → Settings → Connectors → API keys"
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
        // Titles are shown and stored verbatim, never re-worded.
        title: pickString(row, ["title", "name"]) ?? "Untitled meeting",
        date: pickString(row, ["created_at", "createdAt", "date", "started_at"]),
      };
    })
    .filter((n): n is GranolaNote => Boolean(n));
  const hasMore = body["hasMore"] === true;
  const cursor = pickString(body, ["cursor", "next_cursor"]);
  return { notes, cursor: hasMore ? cursor : null };
}

type GranolaPerson = { name: string | null; email: string | null };

function person(value: unknown): GranolaPerson | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const name = pickString(row, ["name", "display_name", "full_name"]);
  const email = pickString(row, ["email"]);
  return name || email ? { name, email } : null;
}

/**
 * GRANOLA-1: who the transcript's audio sources stand for. Granola records audio
 * sources, not voices: the microphone belongs to whoever recorded (the note's
 * owner) and call audio is everyone else. A name is used for call audio only when
 * exactly one other person is on the invite.
 */
export function granolaSpeakers(note: Record<string, unknown>): { recorder: string | null; other: string | null } {
  const owner = person(note["owner"]) ?? person(note["creator"]);
  const list = Array.isArray(note["attendees"]) ? (note["attendees"] as unknown[]) : [];
  const ownerKey = (owner?.email ?? owner?.name ?? "").toLowerCase();
  const others = list
    .map(person)
    .filter((p): p is GranolaPerson => Boolean(p))
    .filter((p) => (p.email ?? p.name ?? "").toLowerCase() !== ownerKey);
  const unique = [...new Map(others.map((p) => [(p.email ?? p.name ?? "").toLowerCase(), p])).values()];
  return {
    recorder: owner?.name ?? owner?.email ?? null,
    other: unique.length === 1 ? (unique[0]!.name ?? unique[0]!.email) : null,
  };
}

/**
 * GRANOLA-1: the label for one transcript line. Granola sends the speaker as an
 * object ({ source: "microphone" | "speaker", diarization_label? }); older notes
 * may carry a plain string. Before this, the object was read as text and dropped,
 * so every imported transcript had no speakers at all.
 */
export function granolaSpeakerLabel(speaker: unknown, who: { recorder: string | null; other: string | null }): string | null {
  if (typeof speaker === "string") return speaker.trim() || null;
  if (!speaker || typeof speaker !== "object") return null;
  const row = speaker as Record<string, unknown>;
  const diarized = pickString(row, ["diarization_label"]);
  if (diarized) return diarized;
  const source = (pickString(row, ["source"]) ?? "").toLowerCase();
  if (source === "microphone") return who.recorder ?? "Microphone";
  if (source === "speaker" || source === "system" || source === "system_audio") return who.other ?? "Others on the call";
  return pickString(row, ["name", "label"]);
}

/** GRANOLA-1: one plain line saying how the speaker labels were assigned, so a reader can judge them. */
export function granolaSpeakerNote(who: { recorder: string | null; other: string | null }, used: { mic: boolean; call: boolean }): string | null {
  if (!used.mic && !used.call) return null;
  const parts: string[] = [];
  if (used.mic) parts.push(`the microphone is labelled ${who.recorder ?? "Microphone"}, who recorded the call`);
  if (used.call) parts.push(who.other ? `call audio is labelled ${who.other}, the only other person on the invite` : "call audio is labelled Others on the call");
  return `_Speakers: ${parts.join("; ")}. Granola records audio sources, not voices, so a label can be wrong if someone else spoke into the same source._`;
}

export function renderGranolaTranscript(raw: unknown, who: { recorder: string | null; other: string | null }): string | null {
  if (typeof raw === "string") return raw;
  if (!Array.isArray(raw)) return null;
  const used = { mic: false, call: false };
  const lines = (raw as Record<string, unknown>[])
    .map((line) => {
      const text = pickString(line, ["text", "content", "value"]);
      if (!text) return null;
      const speaker = line["speaker"] ?? line["source"] ?? line["role"];
      if (speaker && typeof speaker === "object") {
        const source = (pickString(speaker as Record<string, unknown>, ["source"]) ?? "").toLowerCase();
        const diarized = pickString(speaker as Record<string, unknown>, ["diarization_label"]);
        if (!diarized && source === "microphone") used.mic = true;
        if (!diarized && source && source !== "microphone") used.call = true;
      }
      const label = granolaSpeakerLabel(speaker, who);
      return label ? `**${label}:** ${text}` : text;
    })
    .filter((l): l is string => Boolean(l));
  if (lines.length === 0) return null;
  const note = granolaSpeakerNote(who, used);
  return [note, lines.join("\n\n")].filter(Boolean).join("\n\n");
}

/** One note with its transcript, rendered as markdown for the work item. */
export async function fetchGranolaNote(
  key: string,
  id: string,
): Promise<{ title: string; date: string | null; markdown: string } | null> {
  let body: Record<string, unknown>;
  let separateTranscript: unknown = undefined;
  try {
    body = await call(key, `/notes/${encodeURIComponent(id)}?include=transcript`);
  } catch (error) {
    // Granola answers 413 TRANSCRIPT_TOO_LARGE for long calls; the transcript then has its own endpoint.
    if (!(error instanceof GranolaError) || error.status !== 413) throw error;
    body = await call(key, `/notes/${encodeURIComponent(id)}`);
    const t = await call(key, `/notes/${encodeURIComponent(id)}/transcript`);
    separateTranscript = t["transcript"] ?? t["data"] ?? t["items"];
  }
  const note = (body["note"] ?? body["data"] ?? body ?? {}) as Record<string, unknown>;
  const title = pickString(note, ["title", "name"]) ?? "Untitled meeting";
  const date = pickString(note, ["created_at", "createdAt", "date", "started_at"]);

  const summary = pickString(note, ["summary", "ai_summary", "markdown", "content", "notes"]);
  const transcript = renderGranolaTranscript(separateTranscript ?? note["transcript"], granolaSpeakers(note));

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
