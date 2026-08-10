import { unzipSync, strFromU8 } from "fflate";

import type { ImportVendor } from "@/lib/import-vendors";

export type ParsedTurnRecord = {
  turn_no: number;
  role: "user" | "assistant";
  content: string;
  ts: string | null;
};

export type ParsedConversation = {
  orig_id: string;
  title: string;
  created_at: string | null;
  first_ts: string | null;
  last_ts: string | null;
  models: string[];
  warnings: string[];
  turns: ParsedTurnRecord[];
};

export type ParseFailure = { record: string; reason: string };

export type ParseResult = {
  conversations: ParsedConversation[];
  failures: ParseFailure[];
};

function toIso(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function finalize(conv: Omit<ParsedConversation, "first_ts" | "last_ts">): ParsedConversation {
  const stamps = conv.turns
    .map((t) => t.ts)
    .filter((t): t is string => Boolean(t))
    .sort();
  return {
    ...conv,
    first_ts: stamps[0] ?? conv.created_at,
    last_ts: stamps[stamps.length - 1] ?? conv.created_at,
  };
}

/* ------------------------------------------------------------------ files */

type LoadedPart = { name: string; text: string };

/** Read one or more dropped files, expanding archives. Nothing leaves the browser. */
export async function readImportFiles(files: File[]): Promise<LoadedPart[]> {
  const parts: LoadedPart[] = [];
  for (const file of files) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
      for (const [name, bytes] of Object.entries(entries)) {
        const lower = name.toLowerCase();
        if (lower.endsWith("/")) continue;
        if (
          lower.endsWith("conversations.json") ||
          /conversations-\d+\.json$/.test(lower) ||
          lower.endsWith("myactivity.json") ||
          lower.endsWith(".csv")
        ) {
          parts.push({ name, text: strFromU8(bytes) });
        }
      }
    } else {
      parts.push({ name: file.name, text: await file.text() });
    }
  }
  if (parts.length === 0) throw new Error("Nothing readable in that file. Try the paste fallback.");
  return parts;
}

function parseJsonParts(parts: LoadedPart[]): { records: unknown[]; failures: ParseFailure[] } {
  const records: unknown[] = [];
  const failures: ParseFailure[] = [];
  for (const part of parts) {
    try {
      const value = JSON.parse(part.text) as unknown;
      if (Array.isArray(value)) records.push(...value);
      else if (value && typeof value === "object") records.push(value);
      else failures.push({ record: part.name, reason: "File is not a conversation list." });
    } catch {
      failures.push({ record: part.name, reason: "File isn't valid JSON." });
    }
  }
  return { records, failures };
}

/* --------------------------------------------------------------- chatgpt */

type ChatGptNode = {
  parent?: string | null;
  message?: {
    author?: { role?: string };
    create_time?: number | null;
    content?: { content_type?: string; parts?: unknown[] };
    metadata?: { model_slug?: string };
  } | null;
};

function parseChatGpt(records: unknown[]): ParseResult {
  const findLeafNode = (mapping: Record<string, ChatGptNode>): string | undefined => {
    const parents = new Set(
      Object.values(mapping)
        .map((n) => n.parent)
        .filter((p): p is string => Boolean(p)),
    );
    const ids = Object.keys(mapping);
    return ids.reverse().find((id) => !parents.has(id));
  };
  const conversations: ParsedConversation[] = [];
  const failures: ParseFailure[] = [];

  records.forEach((entry, index) => {
    const conv = entry as Record<string, unknown>;
    const label = String(conv["title"] ?? `conversation ${index + 1}`);
    try {
      const mapping = (conv["mapping"] ?? {}) as Record<string, ChatGptNode>;
      if (!conv["mapping"]) throw new Error("No message mapping in this record.");
      const chain: ChatGptNode[] = [];
      let cursor = (conv["current_node"] as string | undefined) ?? findLeafNode(mapping);
      const seen = new Set<string>();
      while (cursor && mapping[cursor] && !seen.has(cursor)) {
        seen.add(cursor);
        const node = mapping[cursor] as ChatGptNode;
        chain.push(node);
        cursor = node.parent ?? undefined;
      }
      chain.reverse();

      const turns: ParsedTurnRecord[] = [];
      const models = new Set<string>();
      for (const node of chain) {
        const message = node.message;
        const role = message?.author?.role;
        if (role !== "user" && role !== "assistant") continue;
        if (!message) continue;
        const contentType = message.content?.content_type;
        if (contentType && contentType !== "text") continue;
        const content = (message.content?.parts ?? [])
          .filter((p): p is string => typeof p === "string")
          .join("\n")
          .trim();
        if (!content) continue;
        if (message.metadata?.model_slug) models.add(message.metadata.model_slug);
        turns.push({ turn_no: turns.length + 1, role, content, ts: toIso(message.create_time) });
      }
      if (turns.length === 0) throw new Error("No readable messages in this conversation.");

      const title = String(conv["title"] ?? "").trim();
      conversations.push(
        finalize({
        orig_id: String(conv["conversation_id"] ?? conv["id"] ?? (title || `cg-${index}`)),
          title: title || (turns[0] as ParsedTurnRecord).content.slice(0, 60),
          created_at: toIso(conv["create_time"]),
          models: Array.from(models),
          warnings: [],
          turns,
        }),
      );
    } catch (e) {
      failures.push({ record: label, reason: (e as Error).message });
    }
  });

  return { conversations, failures };
}

/* ---------------------------------------------------------------- claude */

function parseClaude(records: unknown[]): ParseResult {
  const conversations: ParsedConversation[] = [];
  const failures: ParseFailure[] = [];

  records.forEach((entry, index) => {
    const conv = entry as Record<string, unknown>;
    const label = String(conv["name"] ?? conv["uuid"] ?? `conversation ${index + 1}`);
    try {
      const messages = conv["chat_messages"];
      if (!Array.isArray(messages)) throw new Error("No chat_messages in this record.");
      const turns: ParsedTurnRecord[] = [];
      for (const raw of messages as Record<string, unknown>[]) {
        const sender = raw["sender"];
        const role = sender === "human" ? "user" : sender === "assistant" ? "assistant" : null;
        if (!role) continue;
        let content = typeof raw["text"] === "string" ? (raw["text"] as string) : "";
        if (!content.trim() && Array.isArray(raw["content"])) {
          content = (raw["content"] as Record<string, unknown>[])
            .filter((b) => b["type"] === "text" && typeof b["text"] === "string")
            .map((b) => b["text"] as string)
            .join("\n");
        }
        content = content.trim();
        if (!content) continue;
        turns.push({ turn_no: turns.length + 1, role, content, ts: toIso(raw["created_at"]) });
      }
      if (turns.length === 0) throw new Error("No readable messages in this conversation.");

      const gap = turns.some((turn, i) => i > 0 && turns[i - 1]?.role === turn.role);
      const title = String(conv["name"] ?? "").trim();
      conversations.push(
        finalize({
          orig_id: String(conv["uuid"] ?? (title || `cl-${index}`)),
          title:
            title && title.toLowerCase() !== "untitled"
              ? title
              : (turns[0] as ParsedTurnRecord).content.slice(0, 60),
          created_at: toIso(conv["created_at"]),
          models: [],
          warnings: gap ? ["possible missing replies"] : [],
          turns,
        }),
      );
    } catch (e) {
      failures.push({ record: label, reason: (e as Error).message });
    }
  });

  return { conversations, failures };
}

/* ---------------------------------------------------------------- gemini */

const THIRTY_MIN = 30 * 60 * 1000;

function parseGemini(records: unknown[]): ParseResult {
  const failures: ParseFailure[] = [];
  type Item = { ts: string | null; chatId: string | null; role: "user" | "assistant"; content: string };
  const items: Item[] = [];

  records.forEach((entry, index) => {
    const rec = entry as Record<string, unknown>;
    const label = String(rec["title"] ?? `activity ${index + 1}`).slice(0, 60);
    try {
      const title = typeof rec["title"] === "string" ? rec["title"] : "";
      const rawText = title.replace(/^Prompted\s*/i, "").trim();
      const details = typeof rec["details"] === "string" ? rec["details"] : "";
      const content = (rawText || details).trim();
      if (!content) throw new Error("Activity record has no prompt text.");
      const url = typeof rec["titleUrl"] === "string" ? rec["titleUrl"] : "";
      const chatMatch = url.match(/\/app\/([A-Za-z0-9_-]+)/);
      items.push({
        ts: toIso(rec["time"]),
        chatId: chatMatch?.[1] ?? null,
        role: /^Prompted/i.test(title) ? "user" : "assistant",
        content,
      });
    } catch (e) {
      failures.push({ record: label, reason: (e as Error).message });
    }
  });

  items.sort((a, b) => (a.ts ?? "").localeCompare(b.ts ?? ""));

  const groups: { key: string; inferred: boolean; items: Item[] }[] = [];
  for (const item of items) {
    if (item.chatId) {
      const existing = groups.find((g) => g.key === item.chatId && !g.inferred);
      if (existing) {
        existing.items.push(item);
        continue;
      }
      groups.push({ key: item.chatId, inferred: false, items: [item] });
      continue;
    }
    const last = groups[groups.length - 1];
    const lastItem = last?.items[last.items.length - 1];
    const close =
      last?.inferred &&
      lastItem?.ts &&
      item.ts &&
      new Date(item.ts).getTime() - new Date(lastItem.ts).getTime() <= THIRTY_MIN;
    if (last && close) last.items.push(item);
    else groups.push({ key: `time-${groups.length}`, inferred: true, items: [item] });
  }

  const conversations = groups.map((group, index) =>
    finalize({
      orig_id: group.inferred
        ? `gemini-${group.items[0]?.ts ?? index}-${index}`
        : `gemini-${group.key}`,
      title: (group.items[0]?.content ?? "Gemini conversation").slice(0, 60),
      created_at: group.items[0]?.ts ?? null,
      models: ["Gemini"],
      warnings: group.inferred ? ["grouping approximate"] : [],
      turns: group.items.map((item, i) => ({
        turn_no: i + 1,
        role: item.role,
        content: item.content,
        ts: item.ts,
      })),
    }),
  );

  return { conversations, failures };
}

/* --------------------------------------------------------------- copilot */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/\r\n/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i] as string;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function pickIndex(header: string[], candidates: string[]): number {
  return header.findIndex((h) => candidates.some((c) => h.toLowerCase().includes(c)));
}

function parseCopilot(parts: LoadedPart[]): ParseResult {
  const conversations: ParsedConversation[] = [];
  const failures: ParseFailure[] = [];

  for (const part of parts) {
    const rows = parseCsv(part.text);
    const header = rows.shift();
    if (!header) {
      failures.push({ record: part.name, reason: "Empty CSV file." });
      continue;
    }
    const iTime = pickIndex(header, ["date", "time"]);
    const iPrompt = pickIndex(header, ["prompt", "question", "user", "request", "input"]);
    const iReply = pickIndex(header, ["summary", "response", "reply", "answer", "output"]);
    const iConv = pickIndex(header, ["conversation", "session", "thread", "chat id"]);
    if (iPrompt < 0 && iReply < 0) {
      failures.push({
        record: part.name,
        reason: "No prompt or summary column found in this CSV.",
      });
      continue;
    }

    const groups = new Map<string, { ts: string | null; turns: ParsedTurnRecord[] }>();
    rows.forEach((row, index) => {
      const prompt = (iPrompt >= 0 ? row[iPrompt] ?? "" : "").trim();
      const reply = (iReply >= 0 ? row[iReply] ?? "" : "").trim();
      if (!prompt && !reply) {
        failures.push({ record: `${part.name} row ${index + 2}`, reason: "Row has no text." });
        return;
      }
      const ts = iTime >= 0 ? toIso(row[iTime]) : null;
      const key = (iConv >= 0 ? row[iConv] ?? "" : "").trim() || `${part.name}-row-${index}`;
      const group = groups.get(key) ?? { ts, turns: [] };
      if (prompt) {
        group.turns.push({ turn_no: group.turns.length + 1, role: "user", content: prompt, ts });
      }
      if (reply) {
        group.turns.push({
          turn_no: group.turns.length + 1,
          role: "assistant",
          content: reply,
          ts,
        });
      }
      if (!group.ts) group.ts = ts;
      groups.set(key, group);
    });

    for (const [key, group] of groups) {
      if (group.turns.length === 0) continue;
      conversations.push(
        finalize({
          orig_id: `copilot-${key}`,
          title: (group.turns[0] as ParsedTurnRecord).content.slice(0, 60),
          created_at: group.ts,
          models: ["Copilot"],
          warnings: [],
          turns: group.turns,
        }),
      );
    }
  }

  return { conversations, failures };
}

/* ----------------------------------------------------------------- entry */

export function parseImport(vendor: ImportVendor, parts: LoadedPart[]): ParseResult {
  if (vendor === "copilot") return sortResult(parseCopilot(parts));
  const { records, failures } = parseJsonParts(parts);
  const result =
    vendor === "chatgpt"
      ? parseChatGpt(records)
      : vendor === "claude"
        ? parseClaude(records)
        : parseGemini(records);
  return sortResult({
    conversations: result.conversations,
    failures: [...failures, ...result.failures],
  });
}

function sortResult(result: ParseResult): ParseResult {
  return {
    ...result,
    conversations: [...result.conversations].sort((a, b) =>
      (b.first_ts ?? "").localeCompare(a.first_ts ?? ""),
    ),
  };
}

export function serializeConversation(conv: ParsedConversation): string {
  return conv.turns.map((t) => `${t.role}: ${t.content}`).join("\n\n");
}