import { STEPS_VERIFIED, VENDORS, type ImportVendor } from "@/lib/import-vendors";

export function VendorGuide({ vendor }: { vendor: ImportVendor }) {
  const meta = VENDORS[vendor];
  return (
    <div className="rounded-[var(--radius)] border border-border bg-secondary/60 p-4">
      <p className="micro-label">Get your {meta.label} file</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
        {meta.guide}
      </p>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {STEPS_VERIFIED}
      </p>
    </div>
  );
}
