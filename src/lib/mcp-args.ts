/**
 * Stale-schema tolerance. Clients cache the tool schema at connect time and
 * some send a parameter added later as a JSON string. A string that parses to
 * an array or object is used as that value; anything else is left alone so the
 * existing validation and its error text still apply.
 */
export function coerceJsonArg(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!(trimmed.startsWith("[") || trimmed.startsWith("{"))) return value;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return parsed !== null && typeof parsed === "object" ? parsed : value;
  } catch {
    return value;
  }
}

const TOP_LEVEL = ["decisions", "attachments", "messages", "window", "source_project", "meta"] as const;

function coerceEach(list: unknown, key: string): unknown {
  if (!Array.isArray(list)) return list;
  return list.map((entry) =>
    entry && typeof entry === "object" && key in entry
      ? { ...(entry as Record<string, unknown>), [key]: coerceJsonArg((entry as Record<string, unknown>)[key]) }
      : entry,
  );
}

/** The push tools' arguments with stringified arrays and objects parsed. */
export function coercePushArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...args };
  for (const key of TOP_LEVEL) if (key in out) out[key] = coerceJsonArg(out[key]);
  if ("messages" in out) out["messages"] = coerceEach(out["messages"], "covers");
  if ("attachments" in out) out["attachments"] = coerceEach(out["attachments"], "file_ref");
  return out;
}
