import { TRUST_SUMMARY_LINE } from "@/lib/firm-dashboard-shared";

/**
 * The one line an admin always reads. The full honesty card lives in the
 * privacy panel at the foot of the page, behind "Read the rules".
 */
export function TrustSummary() {
  return (
    <section data-testid="trust-summary">
      <p className="text-sm text-foreground">{TRUST_SUMMARY_LINE}</p>
    </section>
  );
}
