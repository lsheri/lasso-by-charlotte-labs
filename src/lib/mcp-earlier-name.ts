import { BRANDS, type Brand } from "@/design/brand/brand";

/**
 * Phase 4 PR10: after a rename, people keep saying the name they learned, and some named their connector by it. The
 * push tool keeps answering to it. The product was Lasso, then Charlotte (16 Nov 2026), then Lasso again under the
 * Slate look (19 Nov 2026), so whichever name it speaks as now, the other one is the earlier name. The original
 * Lasso, before any rename, has none, and its tool description is unchanged.
 */
export const EARLIER_PRODUCT_NAME = "Lasso";

/** The name people may still use for this brand, or null when the product has only ever had this one. */
export function earlierNameFor(brand: Brand): string | null {
  if (brand.look.legacyDefault) return null;
  return brand.name === EARLIER_PRODUCT_NAME ? BRANDS.charlotte.name : EARLIER_PRODUCT_NAME;
}

/** The sentence that leads the push tool's description when people may still use an earlier name. */
export function earlierNameLine(product: string, earlier: string | null = EARLIER_PRODUCT_NAME): string {
  if (!earlier || product === earlier) return "";
  return `The person may also say 'Push to ${earlier}' or 'send to ${earlier}': ${earlier} was ${product}'s earlier name, and the connector may still be listed under it, so treat it exactly the same. `;
}
