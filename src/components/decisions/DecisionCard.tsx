import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SuggestDot } from "@/components/common/Suggested";
import { Textarea } from "@/components/ui/textarea";
import { srcsOf, useDecisionSourceItems, type DecisionRow } from "@/hooks/use-decisions";

export function DecisionCard({
  decision,
  onConfirm,
  onSaveEdit,
  onDiscard,
  onOpenSource,
}: {
  decision: DecisionRow;
  onConfirm: () => void;
  onSaveEdit: (fields: { situation: string; call_text: string; why: string }) => void;
  onDiscard: () => void;
  onOpenSource: (workItemId: string) => void;
}) {
  const isDraft = decision.status === "draft";
  const [editing, setEditing] = useState(false);
  const [situation, setSituation] = useState(decision.situation);
  const [callText, setCallText] = useState(decision.call_text);
  const [why, setWhy] = useState(decision.why);

  const srcs = srcsOf(decision);
  const sourceItems = Array.from(new Set(srcs.map((s) => s.work_item_id)));
  const { data: itemInfo } = useDecisionSourceItems(sourceItems);

  function sourceLabelFor(id: string): string {
    const info = itemInfo?.[id];
    const hasTurn = srcs.some((s) => s.work_item_id === id && s.turn_id);
    if (hasTurn) return info ? `In the conversation · ${info.title}` : "Moment in the conversation";
    if (!info) return "Source";
    if (info.type === "ai_thread") return `Conversation · ${info.title}`;
    return `Where it landed · ${info.title}`;
  }

  return (
    <article
      className={
        isDraft
          ? "rounded-[var(--radius)] border border-dashed border-muted-foreground/50 border-l-[3px] px-6 py-5"
          : "rounded-[var(--radius)] border border-border bg-card px-6 py-5 shadow-card"
      }
      style={
        isDraft
          ? {
              background: "var(--suggest-wash)",
              borderLeftStyle: "solid",
              borderLeftColor: "var(--suggest-edge)",
            }
          : {}
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="micro-label flex items-center gap-2">
          {isDraft ? <SuggestDot /> : null}
          {isDraft ? "Drafted by Lasso · Awaiting your review" : "Confirmed"}
        </span>
        {decision.date_label ? (
          <span className="font-mono text-[11px] text-muted-foreground">{decision.date_label}</span>
        ) : null}
      </div>

      <div className="mt-5 space-y-4">
        <Field label="The situation">
          {editing ? (
            <Textarea value={situation} onChange={(e) => setSituation(e.target.value)} rows={2} />
          ) : (
            <p className="text-sm text-foreground">{decision.situation}</p>
          )}
        </Field>

        <Field label="The call">
          {editing ? (
            <Textarea value={callText} onChange={(e) => setCallText(e.target.value)} rows={2} />
          ) : (
            <p className="text-sm font-medium text-foreground">{decision.call_text}</p>
          )}
        </Field>

        <Field label="Why it was the right call">
          {editing ? (
            <Textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={3} />
          ) : (
            <p className="border-l-2 border-accent pl-4 text-sm text-foreground">{decision.why}</p>
          )}
        </Field>
      </div>

      {sourceItems.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {sourceItems.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onOpenSource(id)}
              className="max-w-full truncate rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] tracking-[0.06em] text-accent-deep transition-opacity hover:opacity-80"
            >
              {sourceLabelFor(id)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {editing ? (
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onSaveEdit({ situation, call_text: callText, why });
                setEditing(false);
              }}
            >
              Save & confirm
            </Button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </>
        ) : isDraft ? (
          <>
            <Button type="button" size="sm" onClick={onConfirm}>
              Confirm as written
            </Button>
            <button
              type="button"
              className="text-xs text-accent-deep hover:opacity-70"
              onClick={() => setEditing(true)}
            >
              Edit before confirming
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={onDiscard}
            >
              Discard
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={onDiscard}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="micro-label mb-1.5">{label}</div>
      {children}
    </div>
  );
}
