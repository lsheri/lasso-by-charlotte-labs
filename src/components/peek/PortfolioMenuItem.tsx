import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useOrgSettings } from "@/hooks/use-org-settings";
import { usePortfolioToggle } from "@/hooks/use-portfolio";
import { useProfile } from "@/hooks/use-profile";
import { kindOf } from "@/lib/edu-kinds";
import { isEduOrg } from "@/lib/edu-vocab";
import {
  isInPortfolio,
  PORTFOLIO_ADD_LABEL,
  PORTFOLIO_REMOVE_LABEL,
  portfolioSection,
} from "@/lib/portfolio";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * Only a school workspace sees this. Promoting keeps the item exactly where it
 * is; nothing about who can see it changes.
 */
export function PortfolioMenuItem({ item }: { item: WorkItemRow }) {
  const { data: profile } = useProfile();
  const { data: settings } = useOrgSettings();
  const toggle = usePortfolioToggle();
  if (!isEduOrg(profile)) return null;

  const on = isInPortfolio(item);
  const engagementId = item.work_item_tasks[0]?.tasks?.engagement_id ?? null;
  const section = portfolioSection(engagementId ? kindOf(settings, engagementId) : null, {
    fromWorkstream: Boolean(item.work_item_tasks[0]?.task_id),
  });

  return (
    <DropdownMenuItem
      onSelect={() => {
        void toggle({ itemId: item.id, meta: item.meta ?? null, on: !on, section });
      }}
    >
      {on ? PORTFOLIO_REMOVE_LABEL : PORTFOLIO_ADD_LABEL}
    </DropdownMenuItem>
  );
}
