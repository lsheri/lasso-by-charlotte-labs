import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { PrivacyPanel } from "@/components/firm/PrivacyPanel";
import { cn } from "@/lib/utils";
import { HOW_THIS_WORKS_LABEL, TRUST_SUMMARY_LINE } from "@/lib/firm-dashboard-shared";

/**
 * The one line an admin always reads, and behind a quiet toggle the full
 * honesty card, unchanged word for word. Collapsed by default, never removed.
 */
export function TrustSummary() {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <section data-testid="trust-summary">
      <p className="text-sm text-foreground">{TRUST_SUMMARY_LINE}</p>
      <button
        type="button"
        onClick={() => setIsExpanded((s) => !s)}
        aria-expanded={isExpanded}
        className="group mt-1.5 flex items-center gap-1.5 text-left"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-300 ease-out group-hover:text-foreground",
            isExpanded ? "rotate-180" : "rotate-0",
          )}
          aria-hidden
        />
        <span className="micro-label">{HOW_THIS_WORKS_LABEL}</span>
      </button>
      <div
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0">
          <div className="mt-3">
            <PrivacyPanel />
          </div>
        </div>
      </div>
    </section>
  );
}
