import { Pencil } from "lucide-react";

import { EditEngagementDialog } from "@/components/engagements/EditEngagementDialog";
import { EngagementBriefSection } from "@/components/engagements/EngagementBriefSection";
import { clientDisplayName } from "@/lib/clients";

type PanelEngagement = Parameters<typeof EditEngagementDialog>[0]["engagement"];

/**
 * The brief reads as a filled in form, not a note: it is what the work was
 * asked to do, so it sits above everything else on the page and is always
 * legible. The pencil opens the same edit dialog the page has always used.
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
  engagement: PanelEngagement;
  engagementId: string;
  profileId: string;
  orgId: string;
  taskIds: string[];
  hasMappedWork: boolean;
  canEdit: boolean;
  termLabel?: string | null;
}) {
  const brief = engagement.brief?.trim() ? engagement.brief : null;
  return (
    <section className="nb-brief-panel rounded-[var(--radius-md)] border border-border bg-card px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="micro-label">Brief and details</p>
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
    </section>
  );
}
