/** B3: the "/" menu in the Ask composer. Pure, so it can be tested alone. */
export type SlashState = { query: string; start: number };
export type SlashWorkstream = { id: string; name: string };

/** A "/" at the start of a word, just before the caret, opens the menu. */
export function slashQuery(value: string, caret: number): SlashState | null {
  const upTo = value.slice(0, caret);
  const at = upTo.lastIndexOf("/");
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(value[at - 1] ?? "")) return null;
  const query = upTo.slice(at + 1);
  if (/\s/.test(query)) return null;
  return { query, start: at };
}

/** Workstreams whose name contains what is typed after the "/". */
export function filterWorkstreams<T extends SlashWorkstream>(workstreams: readonly T[], query: string, limit = 6): T[] {
  const q = query.toLowerCase();
  return workstreams.filter((w) => w.name.toLowerCase().includes(q)).slice(0, limit);
}

/** The draft with "/Workstream name " in place of the typed "/query". */
export function insertWorkstream(draft: string, start: number, caret: number, name: string): string {
  return `${draft.slice(0, start)}/${name} ${draft.slice(caret)}`;
}
