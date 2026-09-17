import { Paperclip, X } from "lucide-react";
import { useState } from "react";

import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const WORKSPACE_INSTRUCTIONS = [
  "Write to the person who did the work.",
  "Quote what you saw. Never state more than the record holds.",
  "Plain sentences. No praise, no jargon.",
];

/**
 * The one dominant action on the board: say something with the things you
 * picked. It writes nothing anywhere; the card it makes is local to this visit.
 */
export function ContextComposer({
  context,
  onRemoveContext,
  onSubmit,
  canvasInstructions,
  onCanvasInstructions,
}: {
  context: LabNode[];
  onRemoveContext: (id: string) => void;
  onSubmit: (prompt: string) => void;
  canvasInstructions: string;
  onCanvasInstructions: (value: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);

  return (
    <div className="pointer-events-auto w-[420px] max-w-[calc(100vw-2rem)] rounded-[var(--radius)] border border-[var(--nb-graphite)] bg-card p-3 shadow-[var(--shadow-modal)]">
      {showInstructions ? (
        <div className="mb-2 rounded-[var(--radius-control)] border border-[var(--nb-rule)] bg-[var(--nb-grey-1)] p-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
            Inherited from your workspace
          </span>
          <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4 text-[11.5px] leading-[17px] text-muted-foreground">
            {WORKSPACE_INSTRUCTIONS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <span className="mt-2 block font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
            Added on this canvas
          </span>
          <Textarea
            value={canvasInstructions}
            onChange={(event) => onCanvasInstructions(event.target.value)}
            rows={2}
            placeholder="Anything extra for this board."
            className="mt-1 text-[12px]"
          />
          <p className="mt-1 font-hand text-[14px] leading-none text-[var(--nb-mid)]">
            local to this prototype, not kept
          </p>
        </div>
      ) : null}

      {context.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {context.map((node) => (
            <span
              key={node.id}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--nb-pencil)] bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
            >
              {node.title.length > 28 ? `${node.title.slice(0, 25)}...` : node.title}
              <button
                type="button"
                aria-label={`Remove ${node.title} from context`}
                onClick={() => onRemoveContext(node.id)}
                className="text-soft hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mb-2 font-hand text-[15px] leading-none text-[var(--nb-mid)]">
          click a card to bring it in
        </p>
      )}

      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={2}
        placeholder="Ask about what you picked."
        aria-label="Ask about what you picked"
        className="text-[13px]"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowInstructions((open) => !open)}
          aria-label="Instructions for this canvas"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
        >
          <Paperclip className="h-3.5 w-3.5" />
          {context.length} in context
        </button>
        <Button
          size="sm"
          disabled={draft.trim().length === 0}
          onClick={() => {
            onSubmit(draft.trim());
            setDraft("");
          }}
        >
          Put it on the board
        </Button>
      </div>
    </div>
  );
}
