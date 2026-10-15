import { fnv1a } from "@/lib/journey-path";

/** Stable display assignment only; no id means neutral ink. */
export function boardHueIndex(boardId: string | null | undefined): number {
  return boardId ? fnv1a(boardId) % 8 : 0;
}