/**
 * What the firm may read: the rules behind Ask the firm and proposal precedents, as pure functions so they can be
 * tested without a database (firm-brain-review RECOMMENDATION section 5, Liam's answers of 17 Nov).
 *
 * Only boards shared with the firm feed it. On those boards, only placed, non-private work by members who are not
 * guests. Each item then has a firm memory setting: In (read in full and quoted), Summary only (its index card can be
 * found and cited, its body is never loaded) or Out. People on a board read that board's notes in full, because they
 * can already open them.
 */

export type FirmMemory = "in" | "summary" | "out";

/** What a reader may do with one item: quote it, or cite its summary only. */
export type FirmGrade = "full" | "summary";

/** The default per type when the author or board owner has not chosen. Unknown types are summary only. */
export const FIRM_MEMORY_DEFAULTS: Readonly<Record<string, FirmMemory>> = {
  document: "in",
  deck: "in",
  sheet: "in",
  call: "summary",
  ai_thread: "summary",
  image: "summary",
  // Both hold other people's words.
  email: "out",
  message: "out",
};

const CHOICES: readonly FirmMemory[] = ["in", "summary", "out"];

/** The item's setting: an explicit `meta.firm_memory` wins, then "Shown to client" means In, then the type default. */
export function firmMemoryOf(item: { type: string; meta: unknown; shownToClient: boolean }): FirmMemory {
  const chosen = item.meta && typeof item.meta === "object" ? (item.meta as Record<string, unknown>)["firm_memory"] : undefined;
  if (typeof chosen === "string" && (CHOICES as readonly string[]).includes(chosen)) return chosen as FirmMemory;
  if (item.shownToClient) return "in";
  return FIRM_MEMORY_DEFAULTS[item.type] ?? "summary";
}

/**
 * How the asker may read one item, or null when it stays out. Summary only becomes full for people on that board
 * (Liam, 17 Nov: "people who own a board or collaborate on it get that board's full notes"). Out stays out for
 * everyone: it is the author's or owner's explicit choice.
 */
export function firmGrade(memory: FirmMemory, askerIsOnBoard: boolean): FirmGrade | null {
  if (memory === "out") return null;
  if (memory === "in" || askerIsOnBoard) return "full";
  return "summary";
}

/**
 * A proposal's text without its fee, for people without fee access. Proposals keep the fee under its own
 * "## Fees" heading; everything from that heading to the next one is replaced by a line saying it is withheld.
 */
export function withoutFees(body: string): string {
  return body.replace(/^##\s+Fees?\s*$[\s\S]*?(?=^##\s|(?![\s\S]))/m, "## Fees\nShown to admins and leads only.\n\n");
}

export type FirmBoard = {
  id: string;
  title: string;
  /** Null for quick folders, which have no real client. */
  client: string | null;
  brief: string | null;
  /** The board owner's name: the engagement lead. Team names stay on the board. */
  lead: string | null;
  startedOn: string;
  /** The close-out line on finished boards. */
  outcome: string | null;
  askerIsOnBoard: boolean;
};

export type FirmItem = {
  id: string;
  boardId: string;
  type: string;
  title: string;
  date: string | null;
  summary: string | null;
  decisions: string | null;
  entities: string | null;
  grade: FirmGrade;
  shown: { on: string; occasion: string | null }[];
  /** `meta.sow_facts` on a SOW item. Code renders fees from this; a model never sees it. */
  sowFacts: Record<string, unknown> | null;
  /** `meta.deliverable_kind`, for example "proposal". */
  kind: string | null;
};

export type FirmCorpus = {
  orgId: string;
  boards: FirmBoard[];
  items: FirmItem[];
};

/** The coverage line every firm answer carries. No count or names of unshared boards, ever. */
export function coverageLine(corpus: Pick<FirmCorpus, "boards">): string {
  const count = corpus.boards.length;
  return `Read ${count} engagement${count === 1 ? "" : "s"} shared with the firm. Some engagements are not shared.`;
}
