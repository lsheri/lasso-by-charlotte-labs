import { BrandLogo, brandForToolkit } from "@/components/connectors/BrandLogo";
import { cn } from "@/lib/utils";

type ContextFact = { label: string; muted?: boolean };
type ContextVendor = { key: string; label: string; present: boolean };
type ContextAction = { id: string; label: string; onSelect: () => void };

export function ContextCard({
  eyebrow,
  title,
  scopeLabel,
  facts,
  vendors = [],
  actions,
  onChange,
}: {
  eyebrow: string;
  title: string;
  scopeLabel: string;
  facts: ContextFact[];
  vendors?: ContextVendor[];
  actions: ContextAction[];
  onChange?: () => void;
}) {
  const visibleVendors = vendors
    .map((vendor) => ({ ...vendor, brand: brandForToolkit(vendor.key) }))
    .filter((vendor) => vendor.brand !== "unknown");

  return (
    <aside className="relative w-full rounded-[3px] border border-[var(--nb-rule)] bg-[var(--nb-white)] p-[13px_14px] shadow-[0_3px_6px_-3px_rgb(22_24_26_/_0.2)] min-[1100px]:w-[236px]">
      <svg
        width="18"
        height="33"
        viewBox="0 0 26 46"
        aria-hidden="true"
        focusable="false"
        className="absolute left-[10px] top-[-10px]"
      >
        <path
          d="M13 40 C 8.4 40, 6.2 36.6, 6.2 32.6 L 6.2 11.5 C 6.2 7.6, 8.9 5.2, 12.6 5.2 C 16.3 5.2, 18.8 7.7, 18.8 11.4 L 18.8 31.5 C 18.8 34, 17.2 35.6, 15 35.6 C 12.8 35.6, 11.2 34.1, 11.2 31.6 L 11.2 13"
          fill="none"
          stroke="var(--nb-soft)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>

      <div className="pl-[21px]">
        <div className="flex items-start justify-between gap-2">
          <p className="micro-label text-[var(--nb-soft)]">{eyebrow}</p>
          {onChange ? (
            <button
              type="button"
              onClick={onChange}
              className="micro-label text-[var(--nb-pencil)] hover:text-foreground"
            >
              CHANGE
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-[13px] font-medium leading-[18px] text-foreground">{title}</p>
        <p className="micro-label mt-1.5 text-[var(--nb-pencil)]">{scopeLabel}</p>

        {facts.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {facts.map((fact) => (
              <span
                key={fact.label}
                className={cn(
                  "micro-label rounded-full border px-2 py-1",
                  fact.muted
                    ? "border-dashed border-[var(--nb-soft)] text-[var(--nb-soft)]"
                    : "border-[var(--nb-rule)] text-foreground",
                )}
              >
                {fact.label}
              </span>
            ))}
          </div>
        ) : null}

        {visibleVendors.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {visibleVendors.map((vendor) => (
              <span
                key={vendor.key}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-1",
                  vendor.present
                    ? "border-[var(--nb-rule)] text-foreground"
                    : "border-dashed border-[var(--nb-soft)] text-[var(--nb-soft)]",
                )}
              >
                <BrandLogo brand={vendor.brand} size={12} />
                <span className="micro-label">
                  {vendor.label}
                  {vendor.present ? "" : " · NONE YET"}
                </span>
              </span>
            ))}
          </div>
        ) : null}

        {actions.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-[var(--nb-rule)] pt-2.5 min-[1100px]:flex-col min-[1100px]:items-start">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={action.onSelect}
                className="micro-label text-left text-[var(--nb-pencil)] hover:text-foreground"
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}