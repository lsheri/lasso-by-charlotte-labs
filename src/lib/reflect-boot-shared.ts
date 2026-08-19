export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ReflectSessionRow = {
  id: string;
  title: string | null;
  context_scope: JsonValue;
  updated_at: string;
};

export type ReflectMessageRow = {
  id: number;
  role: string;
  content: string;
  created_at: string;
  context_manifest: JsonValue;
};

/** What the Reflect page needs on load: the session list and the open thread. */
export type ReflectBoot = {
  sessions: ReflectSessionRow[];
  messages: ReflectMessageRow[];
};

export const EMPTY_REFLECT_BOOT: ReflectBoot = { sessions: [], messages: [] };
