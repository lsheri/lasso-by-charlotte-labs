/**
 * Pass 155. Pure detection helpers behind the capture.context event.
 *
 * Every function here reads a transcript only far enough to name a band, a
 * boolean, a count, or a machine-generated code. No returned value ever
 * contains a substring of what anyone wrote. Unknown input degrades to the
 * unknown bucket; nothing here throws.
 */

export const LEN_BANDS = ["0-100", "101-400", "401-1500", "1501-5000", "5000+"] as const;
export type LenBand = (typeof LEN_BANDS)[number];

export const DURATION_BANDS = [
  "under_5m",
  "5-30m",
  "30m-2h",
  "2h-1d",
  "1d+",
  "unknown",
] as const;
export type DurationBand = (typeof DURATION_BANDS)[number];

export const FRESHNESS_BANDS = ["under_1h", "1h-1d", "1-7d", "7d+", "unknown"] as const;
export type FreshnessBand = (typeof FRESHNESS_BANDS)[number];

export const PUSH_SIZE_BANDS = ["under_10k", "10-100k", "100k-1m", "1m+"] as const;
export type PushSizeBand = (typeof PUSH_SIZE_BANDS)[number];

export const HOUR_BANDS = ["0-5", "6-11", "12-17", "18-23"] as const;
export type HourBand = (typeof HOUR_BANDS)[number];

export const TOOL_USE_KINDS = ["web_search", "code_execution", "file_tools", "other"] as const;
export type ToolUseKind = (typeof TOOL_USE_KINDS)[number];

export const UNKNOWN = "unknown";

export type CensusTurn = {
  role: string;
  content: string;
  ts?: string | null | undefined;
};

function chars(value: unknown): number {
  return typeof value === "string" ? value.length : 0;
}

/** Character-count band for one turn length. */
export function lenBand(length: number): LenBand {
  const n = Number.isFinite(length) ? Math.max(0, Math.floor(length)) : 0;
  if (n <= 100) return "0-100";
  if (n <= 400) return "101-400";
  if (n <= 1500) return "401-1500";
  if (n <= 5000) return "1501-5000";
  return "5000+";
}

/** Lower median (the smaller of the two middles), so the result is a real length. */
export function medianLength(lengths: readonly number[]): number {
  const sorted = lengths.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor((sorted.length - 1) / 2);
  return sorted[mid] ?? 0;
}

export function medianLenBandForRole(turns: readonly CensusTurn[], role: string): LenBand {
  const lengths = turns.filter((t) => t.role === role).map((t) => chars(t.content));
  return lenBand(medianLength(lengths));
}

/** Wall clock between the first and last turn timestamp. */
export function durationBand(from: unknown, to: unknown): DurationBand {
  const start = toTime(from);
  const end = toTime(to);
  if (start === null || end === null) return "unknown";
  const minutes = Math.max(0, (end - start) / 60000);
  if (minutes < 5) return "under_5m";
  if (minutes <= 30) return "5-30m";
  if (minutes <= 120) return "30m-2h";
  if (minutes <= 1440) return "2h-1d";
  return "1d+";
}

/** Time from the last turn to the moment of the push. */
export function freshnessBand(lastTurn: unknown, pushedAt: unknown): FreshnessBand {
  const last = toTime(lastTurn);
  const pushed = toTime(pushedAt);
  if (last === null || pushed === null) return "unknown";
  const hours = Math.max(0, (pushed - last) / 3600000);
  if (hours < 1) return "under_1h";
  if (hours <= 24) return "1h-1d";
  if (hours <= 24 * 7) return "1-7d";
  return "7d+";
}

export function pushSizeBand(bytes: number): PushSizeBand {
  const n = Number.isFinite(bytes) ? Math.max(0, Math.floor(bytes)) : 0;
  if (n < 10_000) return "under_10k";
  if (n < 100_000) return "10-100k";
  if (n < 1_000_000) return "100k-1m";
  return "1m+";
}

/** UTC six hour bucket. */
export function hourBand(at: unknown): HourBand | typeof UNKNOWN {
  const time = toTime(at);
  if (time === null) return UNKNOWN;
  const hour = new Date(time).getUTCHours();
  if (hour <= 5) return "0-5";
  if (hour <= 11) return "6-11";
  if (hour <= 17) return "12-17";
  return "18-23";
}

/** Monday to Friday, UTC. */
export function isWeekday(at: unknown): boolean {
  const time = toTime(at);
  if (time === null) return false;
  const day = new Date(time).getUTCDay();
  return day >= 1 && day <= 5;
}

function toTime(value: unknown): number | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Structural markers only: fences, tables, image and file references. */
export function modalityFlags(turns: readonly CensusTurn[]): {
  had_files: boolean;
  had_images: boolean;
  had_code_blocks: boolean;
  had_tables: boolean;
} {
  let files = false;
  let images = false;
  let code = false;
  let tables = false;
  for (const turn of turns) {
    const text = typeof turn.content === "string" ? turn.content : "";
    if (!code && /```/.test(text)) code = true;
    if (!tables && /^\s*\|[^\n]*\|\s*$/m.test(text) && /\|\s*-{2,}/.test(text)) tables = true;
    if (!images && /!\[[^\]]*\]\(|\.(png|jpe?g|gif|webp|svg)\b/i.test(text)) images = true;
    if (
      !files &&
      /\.(pdf|docx?|pptx?|xlsx?|csv|txt|md|zip)\b/i.test(text)
    )
      files = true;
    if (files && images && code && tables) break;
  }
  return { had_files: files, had_images: images, had_code_blocks: code, had_tables: tables };
}

const TOOL_PATTERNS: [ToolUseKind, RegExp][] = [
  ["web_search", /\b(web_search|browser_search|google_search|search_web|web\.run)\b/gi],
  ["code_execution", /\b(code_execution|python|repl|run_code|bash_tool|execute_code)\b/gi],
  ["file_tools", /\b(file_search|read_file|write_file|create_file|file_tool)\b/gi],
];

/**
 * Counts by tool kind from transcript structure. A turn whose role is "tool"
 * with no recognizable marker still counts as one "other" tool use.
 */
export function toolUseCounts(turns: readonly CensusTurn[]): Record<ToolUseKind, number> {
  const counts: Record<ToolUseKind, number> = {
    web_search: 0,
    code_execution: 0,
    file_tools: 0,
    other: 0,
  };
  for (const turn of turns) {
    const text = typeof turn.content === "string" ? turn.content : "";
    let matched = 0;
    for (const [kind, pattern] of TOOL_PATTERNS) {
      const found = text.match(new RegExp(pattern.source, "gi"));
      if (found) {
        counts[kind] += found.length;
        matched += found.length;
      }
    }
    if (turn.role === "tool" && matched === 0) counts.other += 1;
  }
  return counts;
}

/** Stopword sets, ISO 639-1. Small on purpose: a guess or "und". */
const LANGUAGE_WORDS: [string, string[]][] = [
  ["en", ["the", "and", "you", "that", "with", "this", "for", "have"]],
  ["es", ["que", "los", "las", "una", "para", "con", "pero", "como"]],
  ["fr", ["les", "des", "une", "pour", "avec", "mais", "vous", "dans"]],
  ["de", ["der", "die", "und", "nicht", "eine", "ist", "mit", "auch"]],
  ["pt", ["que", "uma", "para", "com", "nao", "como", "mais", "isso"]],
  ["it", ["che", "una", "per", "con", "non", "come", "sono", "questo"]],
  ["nl", ["het", "een", "van", "niet", "dat", "voor", "met", "zijn"]],
];

/** ISO 639-1 code, or "und" when the guess is not clear. */
export function detectLanguage(turns: readonly CensusTurn[]): string {
  const sample = turns
    .map((t) => (typeof t.content === "string" ? t.content : ""))
    .join(" ")
    .toLowerCase()
    .slice(0, 4000);
  if (!sample.trim()) return "und";
  if (/[\u4e00-\u9fff]/.test(sample)) return "zh";
  if (/[\u3040-\u30ff]/.test(sample)) return "ja";
  if (/[\uac00-\ud7af]/.test(sample)) return "ko";
  if (/[\u0400-\u04ff]/.test(sample)) return "ru";
  if (/[\u0590-\u05ff]/.test(sample)) return "he";
  if (/[\u0600-\u06ff]/.test(sample)) return "ar";
  const words = sample.split(/[^a-z\u00c0-\u024f]+/).filter(Boolean);
  if (words.length < 5) return "und";
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  let best = "und";
  let bestScore = 0;
  for (const [code, list] of LANGUAGE_WORDS) {
    let score = 0;
    for (const word of list) score += counts.get(word) ?? 0;
    if (score > bestScore) {
      bestScore = score;
      best = code;
    }
  }
  return bestScore >= 2 ? best : "und";
}

export type CaptureContextInput = {
  turns: readonly CensusTurn[];
  clientName?: string | null | undefined;
  clientVersion?: string | null | undefined;
  protocolVersion?: string | null | undefined;
  /** Bytes of the pushed payload. */
  bytes?: number | null | undefined;
  /** When the push happened; defaults to now. */
  pushedAt?: string | Date | null | undefined;
};

export type CaptureContextDims = Record<string, string | number | boolean>;

/** The whole capture.context payload. Bands, booleans, counts, codes. */
export function captureContextDims(input: CaptureContextInput): CaptureContextDims {
  const turns = input.turns ?? [];
  const stamps = turns.map((t) => t.ts).filter((t): t is string => typeof t === "string" && !!t);
  const first = stamps[0] ?? null;
  const last = stamps.length > 0 ? stamps[stamps.length - 1]! : null;
  const pushedAt = input.pushedAt ?? new Date();
  const bytes =
    typeof input.bytes === "number" && Number.isFinite(input.bytes)
      ? input.bytes
      : turns.reduce((sum, t) => sum + chars(t.content), 0);
  const counts = toolUseCounts(turns);
  return {
    client_name: machineLabel(input.clientName),
    client_version: machineLabel(input.clientVersion),
    protocol_version: machineLabel(input.protocolVersion),
    prompt_len_band: medianLenBandForRole(turns, "user"),
    response_len_band: medianLenBandForRole(turns, "assistant"),
    ...modalityFlags(turns),
    tool_web_search: counts.web_search,
    tool_code_execution: counts.code_execution,
    tool_file_tools: counts.file_tools,
    tool_other: counts.other,
    language: detectLanguage(turns),
    duration_band: durationBand(first, last),
    hour_band: hourBand(pushedAt),
    weekday: isWeekday(pushedAt),
    freshness_band: freshnessBand(last, pushedAt),
    push_size_band: pushSizeBand(bytes),
  };
}

/**
 * Machine-generated labels only: client names, versions, protocol strings.
 * Anything with whitespace-heavy or oversized shape is refused as unknown.
 */
export function machineLabel(value: unknown): string {
  if (typeof value !== "string") return UNKNOWN;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) return UNKNOWN;
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._:@/+-]*$/.test(trimmed)) return UNKNOWN;
  if (trimmed.split(/\s+/).length > 4) return UNKNOWN;
  return trimmed;
}
