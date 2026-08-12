/**
 * Operational reporting for the AI layer. #ai-health carries no content, ever:
 * org name, hashed actor, surface, model, timings, tokens, cost, error class.
 * #ai-audit carries content and is structurally impossible for a customer
 * tenant to reach: it fires only when the org id equals AI_AUDIT_ORG_ID.
 */

export type AiErrorClass =
  | "slow_call"
  | "rate_limit"
  | "timeout"
  | "server_error"
  | "context_length"
  | "refusal"
  | "bad_request"
  | "finish_length"
  | "quote_unverified"
  | "extract_empty"
  | "extract_failed"
  | "analysis_failed"
  | "daily_cap"
  | "batch_failed"
  | "model_error";

export type AiHealthEvent = {
  errorClass: AiErrorClass;
  surface: string;
  orgId?: string | null | undefined;
  orgName?: string | null | undefined;
  actorHash?: string | null | undefined;
  model?: string | null | undefined;
  durationMs?: number | null | undefined;
  tokensIn?: number | null | undefined;
  tokensOut?: number | null | undefined;
  cachedIn?: number | null | undefined;
  costUsd?: number | null | undefined;
  /** Short, non-content diagnostic: a status code, an error class, a job id. */
  note?: string | null | undefined;
};

const WINDOW_MS = 5 * 60_000;
const windows = new Map<string, { until: number; suppressed: number }>();

function line(event: AiHealthEvent, suppressed: number): string {
  const bits = [
    `*${event.errorClass}* · ${event.orgName ?? "unknown org"} · ${event.surface}`,
    event.model ? `model: ${event.model}` : null,
    event.durationMs != null ? `duration: ${(event.durationMs / 1000).toFixed(1)}s` : null,
    event.tokensIn != null ? `tokens in: ${event.tokensIn}` : null,
    event.cachedIn ? `cached in: ${event.cachedIn}` : null,
    event.tokensOut != null ? `tokens out: ${event.tokensOut}` : null,
    event.costUsd != null ? `cost: $${event.costUsd.toFixed(6)}` : null,
    event.actorHash ? `actor: ${event.actorHash.slice(0, 12)}` : null,
    event.note ? `note: ${event.note}` : null,
    suppressed > 0 ? `(${suppressed} similar suppressed in the last 5 minutes)` : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

/**
 * At most one message per error class per org per five minutes. A channel that
 * floods gets muted, and a muted channel monitors nothing. Never throws, and
 * never fails the user request that produced it.
 */
export async function reportAiHealth(event: AiHealthEvent): Promise<void> {
  try {
    const key = `${event.orgId ?? "unknown"}:${event.errorClass}`;
    const now = Date.now();
    const open = windows.get(key);
    if (open && now < open.until) {
      open.suppressed += 1;
      return;
    }
    const suppressed = open?.suppressed ?? 0;
    windows.set(key, { until: now + WINDOW_MS, suppressed: 0 });

    const text = line(event, suppressed);
    const hook = process.env["SLACK_AI_HEALTH_WEBHOOK"];
    if (!hook) {
      console.warn(`[ai-health] ${text}`);
      return;
    }
    const response = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(4000),
      body: JSON.stringify({ text }),
    });
    if (!response.ok) console.error(`[ai-health] slack ${response.status}`);
  } catch (e) {
    console.error("[ai-health] report failed:", (e as Error).message);
  }
}

export type AiAuditPost = {
  orgId: string;
  orgName?: string | null | undefined;
  surface: string;
  model: string;
  question: string;
  answer: string;
  itemsRead: { title: string; depth: string }[];
  quoteRepairs: number;
  quoteFailures: string[];
  truncated: boolean;
  tokensIn: number;
  tokensOut: number;
  cachedIn?: number | undefined;
  costUsd: number;
  durationMs?: number | undefined;
};

/**
 * Content, for model improvement, for one org only. If either secret is absent
 * or the org id does not match exactly, nothing is posted and there is no other
 * way to turn it on.
 */
export async function reportAiAudit(post: AiAuditPost): Promise<void> {
  try {
    const hook = process.env["SLACK_AI_AUDIT_WEBHOOK"];
    const allowedOrgId = process.env["AI_AUDIT_ORG_ID"];
    if (!hook || !allowedOrgId) return;
    if (post.orgId !== allowedOrgId) return;

    const items = post.itemsRead
      .slice(0, 20)
      .map((item) => `- ${item.title} (${item.depth})`)
      .join("\n");
    const text = [
      `*AI AUDIT · org: ${post.orgName ?? post.orgId}* · surface: ${post.surface} · model: ${post.model}`,
      `*Question*\n${post.question.slice(0, 2000)}`,
      `*Answer*\n${post.answer.slice(0, 6000)}`,
      `*Items read (${post.itemsRead.length})*\n${items || "none"}`,
      `*Quotes* repairs: ${post.quoteRepairs} · failed after repair: ${post.quoteFailures.length}${
        post.quoteFailures.length
          ? `\n${post.quoteFailures.map((s) => `- ${s.slice(0, 300)}`).join("\n")}`
          : ""
      }`,
      `*Numbers* truncated: ${post.truncated} · tokens in: ${post.tokensIn} · cached in: ${
        post.cachedIn ?? 0
      } · tokens out: ${post.tokensOut} · cost: $${post.costUsd.toFixed(6)}${
        post.durationMs != null ? ` · duration: ${(post.durationMs / 1000).toFixed(1)}s` : ""
      }`,
    ].join("\n\n");

    const response = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ text }),
    });
    if (!response.ok) console.error(`[ai-audit] slack ${response.status}`);
  } catch (e) {
    console.error("[ai-audit] post failed:", (e as Error).message);
  }
}
