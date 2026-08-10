import { unzipSync, strFromU8 } from "fflate";

export type ImportPlatform = "chatgpt" | "claude";

export type ImportedTurn = {
  turn_no: number;
  role: "user" | "assistant";
  content: string;
  ts: string | null;
};

export type ImportedConversation = {
  orig_id: string;
  title: string;
  created_at: string | null;
  turns: ImportedTurn[];
};

function toIso(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }
  if (typeof value === "string" && value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/** Pull conversations.json out of an export archive, or read a raw .json file. */
export async function readExportFile(file: File): Promise<unknown> {
  const isZip = file.name.toLowerCase().endsWith(".zip");
  if (!isZip) return JSON.parse(await file.text());

  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = unzipSync(bytes);
  const key = Object.keys(entries).find((name) =>
    name.toLowerCase().endsWith("conversations.json"),
  );
  if (!key) throw new Error("No conversations.json found inside that archive.");
  return JSON.parse(strFromU8(entries[key] as Uint8Array));
}

type ChatGptNode = {
  id?: string;
  parent?: string | null;
  message?: {
    author?: { role?: string };
    create_time?: number | null;
    content?: { content_type?: string; parts?: unknown[] };
  } | null;
};

function parseChatGpt(raw: unknown): ImportedConversation[] {
  if (!Array.isArray(raw)) throw new Error("Expected a ChatGPT conversations array.");
  const out: ImportedConversation[] = [];

  for (const conv of raw as Record<string, unknown>[]) {
    const mapping = (conv["mapping"] ?? {}) as Record<string, ChatGptNode>;
    const chain: ChatGptNode[] = [];
    let cursor = conv["current_node"] as string | undefined;
    const seen = new Set<string>();
    while (cursor && mapping[cursor] && !seen.has(cursor)) {
      seen.add(cursor);
      const node = mapping[cursor] as ChatGptNode;
      chain.push(node);
      cursor = node.parent ?? undefined;
    }
    chain.reverse();

    const turns: ImportedTurn[] = [];
    for (const node of chain) {
      const message = node.message;
      const role = message?.author?.role;
      if (role !== "user" && role !== "assistant") continue;
      if (message?.content?.content_type !== "text") continue;
      const content = (message.content.parts ?? [])
        .filter((p): p is string => typeof p === "string")
        .join("\n")
        .trim();
      if (!content) continue;
      turns.push({
        turn_no: turns.length + 1,
        role,
        content,
        ts: toIso(message.create_time),
      });
    }
    if (turns.length === 0) continue;

    const title = String(conv["title"] ?? "").trim();
    out.push({
      orig_id: String(conv["id"] ?? conv["conversation_id"] ?? title ?? out.length),
      title: title || (turns[0] as ImportedTurn).content.slice(0, 60),
      created_at: toIso(conv["create_time"]),
      turns,
    });
  }
  return out;
}

function parseClaude(raw: unknown): ImportedConversation[] {
  if (!Array.isArray(raw)) throw new Error("Expected a Claude conversations array.");
  const out: ImportedConversation[] = [];

  for (const conv of raw as Record<string, unknown>[]) {
    const messages = (conv["chat_messages"] ?? []) as Record<string, unknown>[];
    const turns: ImportedTurn[] = [];
    for (const message of messages) {
      const sender = message["sender"];
      const role = sender === "human" ? "user" : sender === "assistant" ? "assistant" : null;
      if (!role) continue;
      let content = typeof message["text"] === "string" ? (message["text"] as string) : "";
      if (!content.trim() && Array.isArray(message["content"])) {
        content = (message["content"] as Record<string, unknown>[])
          .filter((block) => block["type"] === "text" && typeof block["text"] === "string")
          .map((block) => block["text"] as string)
          .join("\n");
      }
      content = content.trim();
      if (!content) continue;
      turns.push({
        turn_no: turns.length + 1,
        role,
        content,
        ts: toIso(message["created_at"]),
      });
    }
    if (turns.length === 0) continue;

    const title = String(conv["name"] ?? "").trim();
    out.push({
      orig_id: String(conv["uuid"] ?? title ?? out.length),
      title: title || (turns[0] as ImportedTurn).content.slice(0, 60),
      created_at: toIso(conv["created_at"]),
      turns,
    });
  }
  return out;
}

export function parseExport(platform: ImportPlatform, raw: unknown): ImportedConversation[] {
  const list = platform === "chatgpt" ? parseChatGpt(raw) : parseClaude(raw);
  return list.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
}

export function serializeConversation(conv: ImportedConversation): string {
  return conv.turns.map((t) => `${t.role}: ${t.content}`).join("\n\n");
}
