import { CheckCircle2 } from "lucide-react";

import {
  engagementHue,
  hueStyles,
  vendorHue,
  workIdentity,
  workIdentityLabel,
} from "@/lib/work-identity";
import type { WorkItemRow } from "@/lib/work-types";

type IdentityItem = Pick<WorkItemRow, "type"> & { source_meta?: WorkItemRow["source_meta"] };

/** The tinted square that carries a work item's identity. */
export function TypeIcon({ item, size = "md" }: { item: IdentityItem; size?: "sm" | "md" }) {
  const identity = workIdentity(item);
  const Icon = identity.icon;
  const styles = hueStyles(identity.hue);
  const box = size === "sm" ? "h-6 w-6 rounded-md" : "h-8 w-8 rounded-lg";
  const glyph = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${box}`}
      style={{ backgroundColor: styles.background }}
      title={workIdentityLabel(item)}
      aria-hidden
    >
      <Icon className={glyph} style={{ color: styles.color }} />
    </span>
  );
}

/**
 * The one type badge used everywhere a work item's type is named: lists, peek
 * headers, pickers, mention menus, import tables. One hue per type, icon plus
 * word so the meaning never rests on colour alone.
 */
export function TypeBadge({
  item,
  size = "md",
  className = "",
}: {
  item: IdentityItem;
  size?: "sm" | "md";
  className?: string;
}) {
  const identity = workIdentity(item);
  const Icon = identity.icon;
  const styles = hueStyles(identity.hue);
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]";
  const glyph = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-mono font-medium uppercase tracking-[0.08em] ${pad} ${className}`}
      style={{
        backgroundColor: styles.background,
        borderColor: styles.border,
        color: styles.color,
      }}
    >
      <Icon className={`${glyph} shrink-0`} aria-hidden />
      {workIdentityLabel(item)}
    </span>
  );
}

/** Icon + name, for headers and dialogs where the label should be spelled out. */
export function TypeChip({ item }: { item: IdentityItem }) {
  return <TypeBadge item={item} />;
}

/** Where a mapped item lives, in that engagement's own colour. */
export function EngagementChip({
  engagementId,
  code,
  taskName,
}: {
  engagementId: string | null | undefined;
  code: string | null | undefined;
  taskName?: string | null | undefined;
}) {
  const styles = hueStyles(engagementHue(engagementId));
  return (
    <span
      className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]"
      style={{ backgroundColor: styles.background, color: styles.color }}
    >
      <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
      {code ?? "Not set"}
      {taskName ? ` · ${taskName}` : ""}
    </span>
  );
}

/** The source a piece of work came from, in that vendor's own tone. */
export function VendorChip({
  vendor,
  label,
}: {
  vendor: string | null | undefined;
  label: string;
}) {
  const hue = vendorHue(vendor);
  if (!hue) {
    return (
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
    );
  }
  const styles = hueStyles(hue);
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em]"
      style={{ backgroundColor: styles.background, color: styles.color }}
    >
      {label}
    </span>
  );
}
