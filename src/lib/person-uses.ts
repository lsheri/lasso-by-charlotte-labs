/**
 * F4: "What will you use Lasso for?" The answer lives on the person's own
 * `people` row and is shown to nobody but that person.
 */
export type PersonUse = "work" | "school" | "personal";

export const USE_ORDER: readonly PersonUse[] = ["personal", "school", "work"];

export const USES_COPY = {
  question: "What will you use Lasso for? Pick any that fit.",
  options: [
    { value: "work", label: "Work" },
    { value: "school", label: "School" },
    { value: "personal", label: "Personal projects" },
  ] as const,
  age: "Lasso is for people 18 and over.",
  save: "Save",
  saving: "Saving…",
  error: "That did not save. Please try again.",
} as const;

/** Sorted, de-duplicated, closed to the three values. */
export function sortUses(picks: readonly string[]): PersonUse[] {
  const set = new Set(picks);
  return [...USE_ORDER].filter((u) => set.has(u));
}

/** Closed dim for person.uses_declared: the sorted picks joined by "+". */
export function usesDim(picks: readonly string[]): string {
  return sortUses(picks).join("+");
}

type PeopleClient = {
  from: (table: "people") => {
    upsert: (
      row: { user_id: string; uses: string[]; uses_declared_at: string },
      opts: { onConflict: string },
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
};

/** Upserts the signed-in person's own row (own-row RLS). */
export async function saveUses(
  client: unknown,
  userId: string,
  picks: readonly string[],
): Promise<{ ok: boolean; uses: PersonUse[] }> {
  const uses = sortUses(picks);
  if (uses.length === 0) return { ok: false, uses };
  const { error } = await (client as PeopleClient)
    .from("people")
    .upsert(
      { user_id: userId, uses, uses_declared_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  return { ok: !error, uses };
}
