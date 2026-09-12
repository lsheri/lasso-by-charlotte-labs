import type { SourceMeta } from "./conversation-shared";
import type { BriefScope } from "./brief-shared";

import type { Database } from "@/integrations/supabase/types";

export type WorkType = Database["public"]["Enums"]["work_type"];
export type WorkVisibility = Database["public"]["Enums"]["work_visibility"];

export type MappedTask = {
  task_id: string;
  tasks: {
    id: string;
    name: string;
    engagement_id: string;
    engagements: { id: string; code: string; title: string } | null;
  } | null;
};

export type WorkItemRow = {
  id: string;
  /** Present wherever ownership decides an affordance, absent in lean reads. */
  owner_id?: string | null | undefined;
  /** The coarse claim: whose work this is, with or without a workstream. */
  client_id?: string | null | undefined;


  title: string;
  type: WorkType;
  source: string;
  visibility: WorkVisibility;
  captured_at: string;
  content_ref: string | null;
  created_at_source?: string | null | undefined;
  work_date?: string | null | undefined;
  content_fidelity?: string | null | undefined;
  source_vendor?: string | null | undefined;
  orig_conversation_id?: string | null | undefined;
  source_meta?: SourceMeta | null | undefined;
  meta?:
    | {
        drive_file_id?: string;
        mime_type?: string | null;
        /** The file's ORIGINAL provider mime, when the stored bytes were exported. */
        source_mime?: string | null;
        web_view_link?: string | null;
        orig_id?: string;
        imported?: boolean;
        warnings?: string[];
        models?: string[];
        role?: string | null;
        expected_total?: number | null;
        brief_scope?: BriefScope | null;
        /** Pass 172: the person promoted this piece to their Portfolio. */
        portfolio?: boolean;
      }
    | null
    | undefined;
  work_item_tasks: MappedTask[];
};

/** A transcript plus every artifact pushed with it, from one MCP conversation. */
export type ConversationGroup = {
  key: string;
  transcript: WorkItemRow | null;
  attachments: WorkItemRow[];
  items: WorkItemRow[];
};

/**
 * Items pushed together share orig_conversation_id. Anything else, and any
 * lone item that happens to carry one, stays an ordinary row.
 */
export function groupConversations(items: WorkItemRow[]): (WorkItemRow | ConversationGroup)[] {
  const counts = new Map<string, WorkItemRow[]>();
  for (const item of items) {
    const key = item.orig_conversation_id;
    if (!key) continue;
    counts.set(key, [...(counts.get(key) ?? []), item]);
  }

  const out: (WorkItemRow | ConversationGroup)[] = [];
  const done = new Set<string>();
  for (const item of items) {
    const key = item.orig_conversation_id;
    const siblings = key ? (counts.get(key) ?? []) : [];
    if (!key || siblings.length < 2) {
      out.push(item);
      continue;
    }
    if (done.has(key)) continue;
    done.add(key);
    const transcript = siblings.find((s) => s.type === "ai_thread") ?? null;
    const attachments = siblings.filter((s) => s !== transcript);
    out.push({ key, transcript, attachments, items: siblings });
  }
  return out;
}

export function isConversationGroup(
  value: WorkItemRow | ConversationGroup,
): value is ConversationGroup {
  return "items" in value;
}

const EXT_MAP: Record<string, WorkType> = {
  pdf: "document",
  doc: "document",
  docx: "document",
  txt: "document",
  md: "document",
  ppt: "deck",
  pptx: "deck",
  key: "deck",
  xls: "sheet",
  xlsx: "sheet",
  csv: "sheet",
  eml: "email",
};

export function workTypeForFile(filename: string): WorkType {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MAP[ext] ?? "document";
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** The date a work element happened: work_date, else source date, else capture date. */
export function effectiveWorkDate(item: {
  work_date?: string | null | undefined;
  created_at_source?: string | null | undefined;
  captured_at: string;
}): string {
  return item.work_date ?? item.created_at_source ?? item.captured_at;
}

/** "google drive", "upload", "chatgpt", a calm human label for a work source. */
export function sourceLabel(source: string): string {
  if (source.startsWith("connector:")) {
    const toolkit = source.slice("connector:".length);
    return toolkit === "googledrive" ? "google drive" : toolkit;
  }
  if (source.startsWith("import:")) return `${source.slice("import:".length)} import`;
  return source;
}
