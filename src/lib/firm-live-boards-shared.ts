/**
 * Boards shared with the firm, as firm view lists them (Liam, 15 Nov). Read-only, live and in progress. Only boards
 * with shared_with_firm = true; counts include only work placed on the board (mapped), never private or unplaced
 * items, and nothing here feeds the aggregate metrics.
 */
export type FirmLiveBoard = {
  id: string;
  title: string;
  client: string | null;
  owner: string | null;
  sharedAt: string | null;
  brief: string | null;
  pieces: number;
};

export const FIRM_LIVE_BOARDS_COPY = {
  title: "Live boards",
  line: "Boards your colleagues shared with the firm. Live and still in progress; finished pieces arrive in the archive.",
  empty: "No boards are shared with the firm yet. Anyone can share theirs from the board's Share button.",
} as const;

/** A brief is shown as one line in the list. */
export function briefLine(brief: string | null, max = 160): string | null {
  const text = (brief ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
