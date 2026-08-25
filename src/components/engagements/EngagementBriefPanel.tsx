import { useState } from "react";
import { ChevronDown, Pencil } from "lucide-react";

import { EditEngagementDialog } from "@/components/engagements/EditEngagementDialog";
import { EngagementBriefSection } from "@/components/engagements/EngagementBriefSection";
import { clientDisplayName } from "@/lib/clients";
import { cn } from "@/lib/utils";
import type { EngagementRow } from "@/lib/engagement-page-shared";

/**
 * The brief reads as a filled in form, not a note: it is what the work was
 * asked to do. The panel starts condensed so the coaching canvas stays open;
 * clicking the header expands it with a chevron motion and CSS grid height
 * transition.
 */
export function EngagementBriefPanel({
  engagement,
  engagementId,
  profileId,
  orgId,
  taskIds,
  hasMappedWork,
  canEdit,
  termLabel,
}: {
  engagement: EngagementRow;
  engagementId: string;
  profileId: string;
  orgId: string;
  taskIds: string[];
  hasMappedWork: boolean;
  canEdit: boolean;
  termLabel?: string | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const brief = engagement.brief?.trim() ? engagement.brief : null;
  return (
    <section className="nb-brief-panel rounded-[var(--radius-md)] border border-border bg-card px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsExpanded((s) => !s)}
          aria-expanded={isExpanded}
          className="group flex flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-300 ease-out group-hover:text-foreground",
              isExpanded ? "rotate-180" : "rotate-0"
            )}
            aria-hidden
          />
          <span className="micro-label">Brief and details</span>
        </button>
        {canEdit ? (
          <EditEngagementDialog
            engagement={engagement}
            trigger={
              <button
                type="button"
                aria-label="Edit the brief and details"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </button>
            }
          />
        ) : null}
      </div>

      <div
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0">
          <div className="mt-3 space-y-4">
            <div>
              <p className="micro-label">Brief</p>
              <p
                className={`mt-1 whitespace-pre-wrap text-[15px] leading-relaxed ${
                  brief ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {brief ?? "No brief yet"}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="micro-label">Client</p>
                <p className="mt-1 text-sm text-foreground">
                  {clientDisplayName(engagement) ?? "Not set"}
                </p>
              </div>
              {termLabel ? (
                <div>
                  <p className="micro-label">Term</p>
                  <p className="mt-1 text-sm text-foreground">{termLabel}</p>
                </div>
              ) : null}
            </div>
            <EngagementBriefSection
              engagementId={engagementId}
              profileId={profileId}
              orgId={orgId}
              taskIds={taskIds}
              hasMappedWork={hasMappedWork}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
