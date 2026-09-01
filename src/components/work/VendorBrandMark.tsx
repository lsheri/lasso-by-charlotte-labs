import { BrandLogo } from "@/components/connectors/BrandLogo";
import { brandForVendor } from "@/lib/tool-brand";
import { vendorFromSource } from "@/lib/work-taxonomy";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * The tool a conversation came from, as its own mark. An identifier, not a
 * banner: nothing renders when the record does not evidence a known tool.
 */
export function VendorBrandMark({
  item,
  size = 14,
}: {
  item: WorkItemRow | null | undefined;
  size?: number;
}) {
  if (!item) return null;
  const brand = brandForVendor(vendorFromSource(item));
  if (!brand) return null;
  return <BrandLogo brand={brand} size={size} />;
}
