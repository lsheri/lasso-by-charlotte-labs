/**
 * Buckets for product telemetry. Exact token counts and costs are operational
 * data and go to #ai-health, never onto an events row.
 */

export function tokensBucket(tokens: number): string {
  if (tokens < 1_000) return "<1k";
  if (tokens < 10_000) return "1-10k";
  if (tokens < 50_000) return "10-50k";
  return "50k+";
}

export function costBucket(usd: number): string {
  if (usd < 0.01) return "<$0.01";
  if (usd < 0.05) return "$0.01-0.05";
  if (usd < 0.25) return "$0.05-0.25";
  return ">$0.25";
}

/** The two dims every AI-backed event carries, and nothing else. */
export function usageDims(usage: { tokensIn: number; costUsd: number }): {
  tokens_in_bucket: string;
  cost_bucket: string;
} {
  return { tokens_in_bucket: tokensBucket(usage.tokensIn), cost_bucket: costBucket(usage.costUsd) };
}
