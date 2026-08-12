import type { TelemetryDims } from "./telemetry-shared";

/** 0 · 1-3 · 4-10 · 11+, counts never leave as exact values. */
function countBucket(n: number): string {
  if (n <= 0) return "0";
  if (n <= 3) return "1-3";
  if (n <= 10) return "4-10";
  return "11+";
}

/** 0 · 1-3 · 4+, for suppression which is small by design. */
function suppressedBucket(n: number): string {
  if (n <= 0) return "0";
  if (n <= 3) return "1-3";
  return "4+";
}

/** Cost never leaves as a number. */
function costBand(usd: number): string {
  if (usd < 0.05) return "under_05";
  if (usd < 0.1) return "05_10";
  if (usd < 0.25) return "10_25";
  return "over_25";
}

/**
 * The dims for analysis.run: the only thing about an analysis that reaches the
 * analytics layer. Content-free, bucketed, and identical for pass and fail.
 */
export function analysisRunDims(input: {
  preset: string;
  scopeType: string;
  status: "completed" | "failed";
  errorClass?: string | null;
  itemsRead: number;
  costUsd: number;
  claims: number;
  suppressed: number;
}): TelemetryDims {
  const dims: TelemetryDims = {
    preset: input.preset,
    scope_type: input.scopeType,
    status: input.status,
    items_read: countBucket(input.itemsRead),
    cost_band: costBand(input.costUsd),
    claims: countBucket(input.claims),
    suppressed: suppressedBucket(input.suppressed),
  };
  if (input.errorClass) dims["error_class"] = input.errorClass;
  return dims;
}
