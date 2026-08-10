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
  title: string;
  type: WorkType;
  source: string;
  visibility: WorkVisibility;
  captured_at: string;
  content_ref: string | null;
  created_at_source?: string | null | undefined;
  meta?:
    | { drive_file_id?: string; mime_type?: string | null; web_view_link?: string | null }
    | null
    | undefined;
  work_item_tasks: MappedTask[];
};

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

/** "google drive", "upload", "chatgpt" — a calm human label for a work source. */
export function sourceLabel(source: string): string {
  if (source.startsWith("connector:")) {
    const toolkit = source.slice("connector:".length);
    return toolkit === "googledrive" ? "google drive" : toolkit;
  }
  return source;
}
