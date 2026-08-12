import { composio } from "@/lib/composio.server";

/**
 * Gmail over Composio.
 *
 * Verified published actions on the gmail toolkit (checked against Composio's
 * tool registry): GMAIL_LIST_LABELS, GMAIL_LIST_THREADS (Gmail query syntax,
 * paginated, optional verbose payloads) and GMAIL_FETCH_MESSAGE_BY_THREAD_ID.
 * Thread listing IS available, so the picker is a real thread browser.
 */

export type GmailLabel = { id: string; name: string; query: string };

export type GmailThreadSummary = {
  id: string;
  subject: string;
  participants: string;
  date: string | null;
  snippet: string;
};

export type GmailMessage = {
  from: string;
  to: string;
  cc: string;
  date: string | null;
  subject: string;
  body: string;
};

async function run(
  slug: string,
  entityId: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = await composio().tools.execute(slug, {
    userId: entityId,
    dangerouslySkipVersionCheck: true,
    arguments: args,
  });
  if (result.successful === false) throw new Error(result.error ?? `${slug} failed`);
  return (result.data ?? {}) as Record<string, unknown>;
}

function pick(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function headerMap(raw: Record<string, unknown>): Record<string, string> {
  const payload = raw["payload"] as Record<string, unknown> | undefined;
  const headers = (payload?.["headers"] ?? raw["headers"]) as
    { name?: string; value?: string }[] | undefined;
  const map: Record<string, string> = {};
  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (h?.name) map[h.name.toLowerCase()] = h.value ?? "";
    }
  }
  return map;
}

/** Composio normalises some fields and passes raw Gmail payloads for others. */
function normalizeMessage(raw: Record<string, unknown>): GmailMessage {
  const headers = headerMap(raw);
  const iso = (() => {
    const stamp = pick(raw, ["messageTimestamp", "message_timestamp", "internalDate"]);
    if (typeof stamp === "string" && stamp) {
      const asNumber = Number(stamp);
      const date =
        Number.isFinite(asNumber) && stamp.length >= 12 ? new Date(asNumber) : new Date(stamp);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    if (headers["date"]) {
      const date = new Date(headers["date"]);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    return null;
  })();

  return {
    from: str(pick(raw, ["sender", "from"])) || headers["from"] || "",
    to: str(pick(raw, ["to", "recipient"])) || headers["to"] || "",
    cc: str(raw["cc"]) || headers["cc"] || "",
    date: iso,
    subject: str(raw["subject"]) || headers["subject"] || "",
    body: str(pick(raw, ["messageText", "message_text", "text", "body", "snippet"])),
  };
}

function threadMessages(raw: Record<string, unknown>): Record<string, unknown>[] {
  const messages = raw["messages"];
  return Array.isArray(messages) ? (messages as Record<string, unknown>[]) : [];
}

const SYSTEM_LABELS: GmailLabel[] = [
  { id: "INBOX", name: "Inbox", query: "in:inbox" },
  { id: "SENT", name: "Sent", query: "in:sent" },
  { id: "STARRED", name: "Starred", query: "is:starred" },
];

/** System chips first, then the user's own labels. */
export async function listGmailLabels(entityId: string): Promise<GmailLabel[]> {
  const out = [...SYSTEM_LABELS];
  try {
    const data = await run("GMAIL_LIST_LABELS", entityId, { user_id: "me" });
    const labels = (data["labels"] ??
      (data["response_data"] as Record<string, unknown>)?.["labels"]) as
      { id?: string; name?: string; type?: string }[] | undefined;
    for (const label of labels ?? []) {
      if (!label?.id || !label.name) continue;
      if (label.type !== "user") continue;
      out.push({ id: label.id, name: label.name, query: `label:"${label.name}"` });
    }
  } catch {
    /* chips degrade to the three system views */
  }
  return out.slice(0, 24);
}

export async function listGmailThreads(
  entityId: string,
  opts: { query: string; pageToken: string | null },
): Promise<{ threads: GmailThreadSummary[]; nextPageToken: string | null }> {
  const data = await run("GMAIL_LIST_THREADS", entityId, {
    user_id: "me",
    query: opts.query,
    verbose: true,
    max_results: 25,
    ...(opts.pageToken ? { page_token: opts.pageToken } : {}),
  });

  const raw = (data["threads"] ?? []) as Record<string, unknown>[];
  const threads: GmailThreadSummary[] = [];
  for (const thread of Array.isArray(raw) ? raw : []) {
    const id = str(pick(thread, ["id", "threadId", "thread_id"]));
    if (!id) continue;
    const messages = threadMessages(thread).map(normalizeMessage);
    const first = messages[0];
    const last = messages[messages.length - 1] ?? first;
    const people = Array.from(
      new Set(
        messages
          .map((m) => m.from)
          .filter(Boolean)
          .map((m) => m.replace(/<.*>/, "").trim() || m),
      ),
    ).slice(0, 3);
    threads.push({
      id,
      subject: first?.subject || str(thread["subject"]) || "(no subject)",
      participants: people.join(", "),
      date: last?.date ?? null,
      snippet: str(pick(thread, ["snippet"])) || (first?.body ?? "").slice(0, 140),
    });
  }

  return {
    threads,
    nextPageToken: str(pick(data, ["nextPageToken", "next_page_token"])) || null,
  };
}

/** Full thread, oldest message first, ready to store verbatim. */
export async function fetchGmailThread(
  entityId: string,
  threadId: string,
): Promise<{ subject: string; date: string | null; markdown: string } | null> {
  const data = await run("GMAIL_FETCH_MESSAGE_BY_THREAD_ID", entityId, {
    user_id: "me",
    thread_id: threadId,
  });
  const messages = threadMessages(data).map(normalizeMessage);
  if (messages.length === 0) return null;

  const ordered = [...messages].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const first = ordered[0]!;
  const subject = first.subject || "(no subject)";

  const blocks = ordered.map((message, index) => {
    const header = [
      `### Message ${index + 1}`,
      `**From:** ${message.from || "Not set"}`,
      `**To:** ${message.to || "Not set"}`,
      ...(message.cc ? [`**Cc:** ${message.cc}`] : []),
      `**Date:** ${message.date ?? "Not set"}`,
      ...(message.subject && message.subject !== subject
        ? [`**Subject:** ${message.subject}`]
        : []),
    ].join("\n");
    return `${header}\n\n${message.body.trim()}`;
  });

  return {
    subject,
    date: first.date,
    markdown: `# ${subject}\n\n${blocks.join("\n\n---\n\n")}\n`,
  };
}

export async function gmailIdentity(entityId: string): Promise<string | null> {
  try {
    const data = await run("GMAIL_GET_PROFILE", entityId, { user_id: "me" });
    const address = pick(data, ["emailAddress", "email_address", "email"]);
    return typeof address === "string" ? address : null;
  } catch {
    return null;
  }
}
