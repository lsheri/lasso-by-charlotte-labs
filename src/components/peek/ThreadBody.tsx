import { useQuery } from "@tanstack/react-query";

import { MarginFlag, VerifyInk } from "@/components/notebook/marks";
import { supabase } from "@/integrations/supabase/client";
import { splitByQuote, turnAnchorId, type ThreadMark } from "@/lib/verify-thread-shared";
import { vendorLabel } from "@/lib/conversation-shared";
import type { WorkItemRow } from "@/lib/work-types";

type Turn = {
  id: string;
  turn_no: number;
  role: string;
  content: string;
  ts: string | null;
  model?: string | null;
  meta?: unknown;
};

const EMPTY_SETTLED: ReadonlySet<string> = new Set<string>();

function turnTime(ts: string | null): string | null {
  if (!ts) return null;
  const date = new Date(ts);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

/** A turn a later push rewrote. The record says so, quietly. */
function revisedLabel(turn: Turn): string | null {
  const meta =
    turn.meta && typeof turn.meta === "object" && !Array.isArray(turn.meta)
      ? (turn.meta as { revised_at?: unknown })
      : null;
  if (typeof meta?.revised_at !== "string") return null;
  const date = new Date(meta.revised_at);
  if (Number.isNaN(date.getTime())) return null;
  return `Revised by a re-push · ${date.toLocaleDateString()}`;
}

/**
 * The model's own words, with any verification ink settled on the claim span.
 * A mark is only ever drawn on a model turn: human turns render untouched.
 */
function TurnContent({
  turn,
  marks,
  activeMarkId,
  settledIds,
  reducedMotion,
}: {
  turn: Turn;
  marks: readonly ThreadMark[];
  activeMarkId: string | null;
  settledIds: ReadonlySet<string>;
  reducedMotion: boolean;
}) {
  const isHuman = turn.role === "user";
  const mark = isHuman ? undefined : marks.find((m) => m.turnNo === turn.turn_no);
  const split = mark ? splitByQuote(turn.content, mark.quote) : null;
  if (!mark || !split) return <>{turn.content}</>;
  return (
    <>
      {split.before}
      <VerifyInk
        verdict={mark.verdict}
        seed={mark.id}
        active={activeMarkId === mark.id || settledIds.has(mark.id)}
        bold={mark.bold !== false}
        reducedMotion={reducedMotion}
      >
        {split.match}
      </VerifyInk>
      {split.after}
    </>
  );
}

/** The conversation itself, shared by the peek panel and the standalone viewer. */
export function ThreadBody({
  item,
  enabled = true,
  marks = [],
  activeMarkId = null,
  settledIds = EMPTY_SETTLED,
  onMarkActivate,
  reducedMotion = false,
}: {
  item: WorkItemRow;
  enabled?: boolean;
  /** Verification ink to settle on model turns. Empty everywhere else. */
  marks?: readonly ThreadMark[];
  activeMarkId?: string | null;
  /** Marks whose ink has settled during the reader's intro pass. */
  settledIds?: ReadonlySet<string>;
  /** Tapping a margin flag activates that finding on the rail. */
  onMarkActivate?: ((markId: string) => void) | undefined;
  reducedMotion?: boolean;
}) {
  const { data: turns, error } = useQuery({
    queryKey: ["turns", item.id],
    enabled,
    queryFn: async (): Promise<Turn[]> => {
      const { data, error: turnsError } = await supabase
        .from("turns")
        .select("id, turn_no, role, content, ts, model, meta")
        .eq("work_item_id", item.id)
        .order("turn_no", { ascending: true });
      if (turnsError) throw turnsError;
      return (data ?? []) as Turn[];
    },
  });

  const meta = item.source_meta ?? null;
  const model = meta?.model ?? null;
  const expectedTotal =
    typeof item.meta?.expected_total === "number" ? item.meta.expected_total : null;
  const turnCount = turns?.length ?? 0;
  const metaBits = [
    meta?.skills_used && meta.skills_used.length > 0
      ? `Skills: ${meta.skills_used.join(", ")}`
      : null,
    meta?.thinking_level && meta.thinking_level !== "none"
      ? `Thinking: ${meta.thinking_level}`
      : null,
    meta?.research_mode && meta.research_mode !== "none"
      ? `Research: ${meta.research_mode.replace("_", " ")}`
      : null,
    meta?.notes ?? null,
  ].filter((bit): bit is string => Boolean(bit));

  return (
    <div className="space-y-4">
      {item.source_vendor || model ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {vendorLabel(item.source_vendor ?? meta?.vendor)}
          {model ? ` · ${model}` : ""}
        </p>
      ) : null}
      {metaBits.length > 0 ? (
        <p className="text-xs text-muted-foreground">{metaBits.join(" · ")}</p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}

      {expectedTotal && turns && turnCount < expectedTotal ? (
        <p className="text-xs text-muted-foreground">
          {turnCount} of {expectedTotal} messages captured so far.
        </p>
      ) : null}

      {item.content_fidelity === "summary" ? (
        <p className="rounded-[var(--radius)] border border-border bg-secondary/60 px-4 py-3 text-sm text-foreground">
          Copilot exports contain summaries, not full replies. For work that matters, paste the
          conversation for full fidelity.
        </p>
      ) : null}

      <div className="space-y-5">
        {(turns ?? []).map((turn) =>
          turn.role === "user" ? (
            <div key={turn.id} className="flex flex-col items-end">
              <div className="micro-label mb-1">
                Turn {turn.turn_no} · {turn.role}
                {turnTime(turn.ts) ? ` · ${turnTime(turn.ts)}` : ""}
              </div>
              <div className="max-w-[90%] whitespace-pre-wrap rounded-[var(--radius)] bg-grey-2 px-4 py-3 font-mono text-xs leading-relaxed text-foreground">
                {turn.content}
              </div>
              {revisedLabel(turn) ? (
                <p className="mt-1 text-[11px] text-muted-foreground">{revisedLabel(turn)}</p>
              ) : null}
            </div>
          ) : (
            (() => {
              const flag = marks.find((m) => m.turnNo === turn.turn_no);
              const lit = flag?.lit === true;
              return (
                <div key={turn.id} id={turnAnchorId(turn.turn_no)}>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="grid w-[16px] shrink-0 place-items-center">
                      {flag ? (
                        <MarginFlag
                          seed={flag.id}
                          verdict={flag.verdict}
                          stroke={flag.stroke}
                          dashed={flag.dashed}
                          label={`Go to the finding on turn ${turn.turn_no}`}
                          {...(onMarkActivate
                            ? { onActivate: () => onMarkActivate(flag.id) }
                            : {})}
                        />
                      ) : null}
                    </span>
                    <span className="micro-label">
                      Turn {turn.turn_no} · {turn.role}
                      {turn.model ? ` · ${turn.model}` : model ? ` · ${model}` : ""}
                      {turnTime(turn.ts) ? ` · ${turnTime(turn.ts)}` : ""}
                    </span>
                  </div>
                  <div
                    data-lit={lit ? "true" : undefined}
                    data-testid={lit ? `turn-lit-${turn.turn_no}` : undefined}
                    className={`max-w-[90%] whitespace-pre-wrap rounded-[var(--radius)] border border-border bg-card px-4 py-3 font-mono text-xs leading-relaxed text-foreground shadow-card${
                      lit ? " nb-turn-lit border-l-[3px]" : ""
                    }`}
                    {...(lit
                      ? {
                          style: {
                            ["--span-color" as string]: flag?.stroke ?? "var(--nb-ink-yellow)",
                            ["--span-wash" as string]:
                              flag?.wash ?? "var(--status-unsourced-wash)",
                          } as React.CSSProperties,
                        }
                      : {})}
                  >
                    <TurnContent
                      turn={turn}
                      marks={marks}
                      activeMarkId={activeMarkId}
                      settledIds={settledIds}
                      reducedMotion={reducedMotion}
                    />
                  </div>
                  {revisedLabel(turn) ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">{revisedLabel(turn)}</p>
                  ) : null}
                </div>
              );
            })()
          ),
        )}
        {turns && turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No turns stored for this item.</p>
        ) : null}
      </div>
    </div>
  );
}
