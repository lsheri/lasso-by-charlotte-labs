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

/** Icon + name, for headers and dialogs where the label should be spelled out. */
export function TypeChip({ item }: { item: IdentityItem }) {
  const identity = workIdentity(item);
  const Icon = identity.icon;
  const styles = hueStyles(identity.hue);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]"
      style={{ backgroundColor: styles.background, color: styles.color }}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {workIdentityLabel(item)}
    </span>
  );
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
      {code ?? "—"}
      {taskName ? ` · ${taskName}` : ""}
    </span>
  );
}

/** The source a piece of work came from, in that vendor's own tone. */
export function VendorChip({ vendor, label }: { vendor: string | null | undefined; label: string }) {
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
