import { useVendorVisible } from "@/hooks/use-vendor-display";
import { vendorLabel } from "@/lib/conversation-shared";
import { sourceLabel, type WorkItemRow } from "@/lib/work-types";

/**
 * Where a piece of work came from, said quietly. Muted, smaller than the title,
 * and absent entirely when we do not actually know the source.
 */
export function VendorMark({ item }: { item: Pick<WorkItemRow, "source" | "source_vendor"> }) {
  const visible = useVendorVisible();
  const vendor = item.source_vendor ?? null;
  const label = vendor
    ? visible
      ? vendorLabel(vendor)
      : "AI"
    : item.source
      ? sourceLabel(item.source)
      : null;
  if (!label || label === "mcp" || label === "manual") return null;
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
      {label}
    </span>
  );
}
