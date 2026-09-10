import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ToneCard } from "@/components/notebook/ToneCard";
import { cn } from "@/lib/utils";

/**
 * Required content, not decoration. The rules of the page sit behind one quiet
 * control, and the control is always here: this is what the firm view can never
 * show, word for word.
 */
export function PrivacyPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <ToneCard tone="record" label="PRIVATE BY DEFAULT" title="The work stays with the person who did it.">
      <div className="mt-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((s) => !s)}
        >
          Read the rules
        </Button>
      </div>
      <div
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0">
          <div className="mt-3">
            <h2 className="micro-label micro-label-section">
              What this view can and cannot show
            </h2>
            <p className="mt-2 text-sm text-foreground">
              This page shows counts and structure for the workspace as a whole. It is built so
              that the work itself stays with the person who did it.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li>
                Never the work: no documents, decks, files, or captured threads. The one exception
                is the archive: work appears there only when the person who owns it ships it, and
                they can take it back.
              </li>
              <li>Never a conversation with Lasso, and never a prompt someone wrote.</li>
              <li>Never a number attached to a person&apos;s name, and never a ranking of people.</li>
              <li>Never a pass rate or a score, here or anywhere else in Lasso.</li>
              <li>
                Work that has not been shared is invisible here by construction, not by setting.
                There is no switch that turns it on.
              </li>
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">
              Where a count would be small enough to point at one person, the number is withheld
              and the page says so instead.
            </p>
          </div>
        </div>
      </div>
    </ToneCard>
  );
}
