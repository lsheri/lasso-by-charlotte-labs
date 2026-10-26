/**
 * P4. Decisions carried by a conversation push. Pure helpers only: parsing,
 * position-to-turn resolution, dedupe and the inbox rule. The push never
 * confirms anything; every accepted decision lands as a draft.
 */

export const MAX_PUSH_DECISIONS = 20;

export type IncomingDecision = {
  situation: string;
  call_text: string;
  why: string | null;
  cites: number[];
};

export type DecisionOutcome = "drafted" | "unchanged" | "skipped" | "held";

export type DecisionReceipt = {
  situation: string;
  call_text: string;
  outcome: DecisionOutcome;
  reason?: string;
  cites: number[];
};

export const DECISION_SKIPPED_REASON = "cites a position not yet stored";
export const DECISION_HELD_REASON =
  "decisions are recorded when the conversation is placed on a board";

/** Parse decisions[]; any invalid entry rejects the whole call. */
export function parsePushDecisions(
  raw: unknown,
): { ok: true; decisions: IncomingDecision[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, decisions: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "decisions must be an array" };
  if (raw.length > MAX_PUSH_DECISIONS) {
    return { ok: false, error: `Too many decisions (${raw.length}). Max is ${MAX_PUSH_DECISIONS}.` };
  }
  const out: IncomingDecision[] = [];
  for (const [index, entry] of raw.entries()) {
    const d = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const situation = typeof d["situation"] === "string" ? d["situation"].trim() : "";
    const call = typeof d["call_text"] === "string" ? d["call_text"].trim() : "";
    if (!situation || !call) {
      return { ok: false, error: `decisions[${index}] needs a non-blank situation and call_text` };
    }
    const cites = d["cites"];
    if (!Array.isArray(cites) || cites.length === 0) {
      return { ok: false, error: `decisions[${index}] must cite at least one message position` };
    }
    if (!cites.every((c) => typeof c === "number" && Number.isInteger(c) && c > 0)) {
      return { ok: false, error: `decisions[${index}].cites must be positive integers` };
    }
    const why = typeof d["why"] === "string" && d["why"].trim() ? d["why"].trim() : null;
    out.push({ situation, call_text: call, why, cites: [...new Set(cites as number[])] });
  }
  return { ok: true, decisions: out };
}

/** Map cited positions to stored turn ids; null when any position is not stored. */
export function resolveCitedTurns(
  cites: number[],
  turnIdByPosition: ReadonlyMap<number, string>,
): string[] | null {
  const ids: string[] = [];
  for (const pos of cites) {
    const turnId = turnIdByPosition.get(pos);
    if (!turnId) return null;
    ids.push(turnId);
  }
  return ids;
}

export type DecisionSrcRef = { work_item_id: string; turn_id: string | null };

function srcKey(srcs: readonly DecisionSrcRef[]): string {
  return srcs
    .map((s) => `${s.work_item_id}:${s.turn_id ?? ""}`)
    .sort()
    .join("|");
}

/** Same call_text and the same set of sources as an existing draft or confirmed decision. */
export function isDuplicateDecision(
  candidate: { call_text: string; srcs: readonly DecisionSrcRef[] },
  existing: readonly { call_text: string; srcs: unknown; status: string }[],
): boolean {
  const key = srcKey(candidate.srcs);
  return existing.some(
    (row) =>
      (row.status === "draft" || row.status === "confirmed") &&
      row.call_text.trim() === candidate.call_text.trim() &&
      Array.isArray(row.srcs) &&
      srcKey(row.srcs as DecisionSrcRef[]) === key,
  );
}

/** Nothing is written unless the conversation landed on a board. */
export function decisionsWritable(target: string, placeResolved: boolean): boolean {
  return target === "workboard" && placeResolved;
}

export function decisionsLine(receipts: readonly DecisionReceipt[]): string {
  if (receipts.length === 0) return "";
  const order: DecisionOutcome[] = ["drafted", "unchanged", "held", "skipped"];
  const parts = order
    .map((o) => [o, receipts.filter((r) => r.outcome === o).length] as const)
    .filter(([, n]) => n > 0)
    .map(([o, n]) => `${n} ${o}`);
  return `Decisions: ${parts.join(", ")}.`;
}

/** The same ledger body is stored by chat pushes and a person's edits. */
export function renderDecisionsMarkdown(title: string, lines: { ord: number; call_text: string; why: string; status: "draft" | "confirmed" | "discarded" }[]): string {
  const labels = { draft: "Open", confirmed: "Agreed", discarded: "Dropped" };
  return `# ${title}\n\n` + lines.map((line) => `${line.ord}. ${line.call_text}\n   Status: ${labels[line.status]}${line.why ? `\n   Why: ${line.why}` : ""}`).join("\n\n");
}

export type MarkdownDecisionLine = { ord: number; call_text: string; why: string; status: "draft" | "confirmed" | "discarded" };

/** The stored format is unescaped; ambiguous entry-shaped reasons follow the conventional entry rule. */
export function parseDecisionsMarkdown(body: string): { title: string; lines: MarkdownDecisionLine[] } {
  const rows = body.replace(/\r\n/g, "\n").split("\n").map((row) => row.trimEnd());
  const title = (rows.shift() ?? "").replace(/^# /, "");
  const starts: { index: number; statusIndex: number }[] = [];
  rows.forEach((row, index) => {
    if (!/^\d+\. /.test(row)) return;
    let next = index + 1;
    while (next < rows.length && !rows[next]?.trim()) next += 1;
    if (/^\s+Status: (Open|Agreed|Dropped)$/.test(rows[next] ?? "")) starts.push({ index, statusIndex: next });
  });
  const statuses: Record<string, MarkdownDecisionLine["status"]> = { Open: "draft", Agreed: "confirmed", Dropped: "discarded" };
  const lines = starts.map((entry, i): MarkdownDecisionLine => {
    const row = rows[entry.index] ?? "";
    const status = (rows[entry.statusIndex] ?? "").trim().slice(8);
    const rest = rows.slice(entry.statusIndex + 1, starts[i + 1]?.index ?? rows.length);
    while (rest.length && !rest[rest.length - 1]?.trim()) rest.pop();
    if (rest[0]?.startsWith("   Why: ")) rest[0] = rest[0].slice(8);
    return { ord: Number(row.slice(0, row.indexOf("."))), call_text: row.slice(row.indexOf(".") + 2), status: statuses[status] ?? "draft", why: rest.join("\n") };
  });
  return { title, lines };
}

export function diffDecisionLines(previous: readonly MarkdownDecisionLine[], current: readonly MarkdownDecisionLine[]) {
  const normalize = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();
  const used = new Set<number>();
  const lines = current.map((line) => {
    const index = previous.findIndex((old, i) => !used.has(i) && normalize(old.call_text) === normalize(line.call_text));
    const old = previous[index];
    if (!old) return { line, change: "added" as const };
    used.add(index);
    const change = old.why !== line.why || old.status !== line.status ? "edited" : old.ord !== line.ord ? "moved" : "unchanged";
    return { line, change };
  });
  return { lines, removed: previous.filter((_, i) => !used.has(i)) };
}
