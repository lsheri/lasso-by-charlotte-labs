import type { WalkthroughEntry } from "./walkthrough";

/**
 * Where the walkthrough was opened from. Set just before navigating, read
 * once when the page records the open. Defaults to the sidebar, which is the
 * entry point that is always there.
 */
let pending: WalkthroughEntry | null = null;

export function markWalkthroughEntry(entry: WalkthroughEntry): void {
  pending = entry;
}

export function consumeWalkthroughEntry(): WalkthroughEntry {
  const entry = pending ?? "sidebar";
  pending = null;
  return entry;
}
