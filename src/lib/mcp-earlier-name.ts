/**
 * Phase 4 PR10: after the flip, pilots will keep saying "push to Lasso" for a while, and some named their connector
 * Lasso. The push tool keeps answering to the product's earlier name. Before the flip the line is empty, so the tool
 * description is unchanged.
 */
export const EARLIER_PRODUCT_NAME = "Lasso";

/** The sentence that leads the push tool's description once the product is no longer called Lasso. */
export function earlierNameLine(product: string): string {
  if (product === EARLIER_PRODUCT_NAME) return "";
  return `The person may also say 'Push to ${EARLIER_PRODUCT_NAME}' or 'send to ${EARLIER_PRODUCT_NAME}': ${EARLIER_PRODUCT_NAME} was ${product}'s earlier name, and the connector may still be listed under it, so treat it exactly the same. `;
}
