/**
 * Pass 174: pure helpers for the daily OpenAI cost fetch. Kept free of any
 * runtime so the window maths and the once-a-day rule can be tested directly.
 */

/** Labels for our own OpenAI projects. Filled once the first run shows real ids. */
export const OPENAI_PROJECT_LABELS: Record<string, string> = {};

export function labelForProject(projectId: string | null): string | null {
  if (!projectId) return null;
  return OPENAI_PROJECT_LABELS[projectId] ?? null;
}

/** UTC calendar day key, e.g. 2026-09-08. */
export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The last 7 whole days up to and including today, as a unix-second window. */
export function costWindow(now: number, days = 7): { startTime: number; endTime: number } {
  const startOfToday = Date.UTC(
    new Date(now).getUTCFullYear(),
    new Date(now).getUTCMonth(),
    new Date(now).getUTCDate(),
  );
  const start = startOfToday - (days - 1) * 86_400_000;
  return { startTime: Math.floor(start / 1000), endTime: Math.floor(now / 1000) };
}

/** Once per calendar day: a run is allowed only when today has not been claimed. */
export function shouldRunToday(lastRunDay: string | null, now: number): boolean {
  return lastRunDay !== dayKey(now);
}

export type CostRow = {
  day: string;
  openai_project_id: string;
  project_label: string | null;
  amount_usd: number;
  currency: string;
  input_tokens: number | null;
  output_tokens: number | null;
  fetched_at: string;
};

type CostsBucket = {
  start_time?: number;
  results?: {
    amount?: { value?: number; currency?: string } | null;
    project_id?: string | null;
    input_tokens?: number | null;
    output_tokens?: number | null;
  }[];
};

export type CostsResponse = { data?: CostsBucket[]; next_page?: string | null; has_more?: boolean };

/** One row per day per project. Buckets with no results contribute nothing. */
export function mapCostBuckets(response: CostsResponse, fetchedAt: string): CostRow[] {
  const rows = new Map<string, CostRow>();
  for (const bucket of response.data ?? []) {
    if (typeof bucket.start_time !== "number") continue;
    const day = dayKey(bucket.start_time * 1000);
    for (const result of bucket.results ?? []) {
      const projectId = result.project_id ?? "unattributed";
      const key = `${day}|${projectId}`;
      const existing = rows.get(key);
      const amount = result.amount?.value ?? 0;
      if (existing) {
        existing.amount_usd += amount;
        if (result.input_tokens != null)
          existing.input_tokens = (existing.input_tokens ?? 0) + result.input_tokens;
        if (result.output_tokens != null)
          existing.output_tokens = (existing.output_tokens ?? 0) + result.output_tokens;
        continue;
      }
      rows.set(key, {
        day,
        openai_project_id: projectId,
        project_label: labelForProject(projectId),
        amount_usd: amount,
        currency: result.amount?.currency ?? "usd",
        input_tokens: result.input_tokens ?? null,
        output_tokens: result.output_tokens ?? null,
        fetched_at: fetchedAt,
      });
    }
  }
  return Array.from(rows.values()).sort((a, b) =>
    a.day === b.day
      ? a.openai_project_id.localeCompare(b.openai_project_id)
      : a.day.localeCompare(b.day),
  );
}
