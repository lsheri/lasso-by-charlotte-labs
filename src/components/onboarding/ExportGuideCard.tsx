import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { ImportFlowDialog } from "@/components/work/import/ImportFlowDialog";
import { Button } from "@/components/ui/button";
import { STEPS_VERIFIED, VENDORS, type ImportVendor } from "@/lib/import-vendors";
import { TOOLS, type ToolId } from "@/lib/onboarding-tools";
import { ToolBadge } from "./ToolBadge";

/** Compact, expandable version of the existing vendor guide. */
export function ExportGuideCard({ tool }: { tool: Extract<ToolId, "gemini" | "copilot"> }) {
  const vendor: ImportVendor = tool;
  const meta = VENDORS[vendor];
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-5 py-4 shadow-card">
      <div className="flex items-start gap-3">
        <ToolBadge tool={tool} size="sm" />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                Bring in your {TOOLS[tool].label} history
              </span>
              <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {meta.tierHint}
              </span>
            </span>
            <ChevronDown
              size={15}
              className={
                open
                  ? "shrink-0 rotate-180 text-muted-foreground transition-transform"
                  : "shrink-0 text-muted-foreground transition-transform"
              }
            />
          </button>

          {open ? (
            <div className="mt-3 space-y-3">
              <p className="whitespace-pre-line text-sm text-muted-foreground">{meta.guide}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {STEPS_VERIFIED}
              </p>
              <ImportFlowDialog
                initialVendor={vendor}
                trigger={
                  <Button type="button" size="sm">
                    Open the importer
                  </Button>
                }
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
