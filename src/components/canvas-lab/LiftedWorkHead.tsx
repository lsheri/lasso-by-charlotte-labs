import { ExternalLink, Minimize2, MoreHorizontal } from "lucide-react";

import { BrandLogo, brandLabel, type BrandKey } from "@/components/connectors/BrandLogo";
import { useVendorVisible } from "@/hooks/use-vendor-display";
import type { LucideIcon } from "lucide-react";

export const LIFT_HEAD_COPY = {
  openIn: (tool: string) => `Open in ${tool}`,
  openOriginal: "Open the original",
  more: "More",
  back: "Back to the board",
} as const;

export type LiftMenuItem = { label: string; onSelect: () => void };

/**
 * T2a (one view, 9 Nov): the one header every lifted piece wears. The tool's mark and name say where the
 * work lives, so the view reads as a window into that tool; "Open in" goes back to it. A workspace that
 * keeps vendors neutral sees the kind icon and "Open the original" instead (AGENTS: reader vendor marks are
 * guarded by useVendorVisible). The header never names a person.
 */
export function LiftedWorkHead({
  title,
  icon: Icon,
  brand,
  dateLine,
  openUrl,
  menu,
  menuOpen,
  onMenuOpenChange,
  onBack,
}: {
  title: string;
  icon: LucideIcon;
  brand: BrandKey | null;
  dateLine: string | null;
  openUrl: string | null;
  menu: LiftMenuItem[];
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onBack: () => void;
}) {
  const vendorVisible = useVendorVisible();
  const showBrand = vendorVisible && brand !== null && brand !== "unknown";
  const tool = showBrand && brand ? brandLabel(brand) : null;
  const metaLine = [tool, dateLine].filter(Boolean).join(" · ");
  const safeUrl = openUrl && /^https:\/\//i.test(openUrl) ? openUrl : null;
  return (
    <>
      {showBrand && brand ? (
        <span className="lift-brand" data-testid="lift-brand">
          <BrandLogo brand={brand} size={20} />
        </span>
      ) : (
        <Icon className="lift-kind" size={16} aria-hidden="true" data-testid="lift-kind" />
      )}
      <span className="lift-id">
        <span className="lift-title">{title}</span>
        {metaLine ? <span className="lift-meta" data-testid="lift-meta">{metaLine}</span> : null}
      </span>
      {safeUrl ? (
        <a className="lift-open" href={safeUrl} target="_blank" rel="noopener noreferrer" data-testid="lift-open">
          {showBrand && brand ? <BrandLogo brand={brand} size={14} /> : null}
          <span>{tool ? LIFT_HEAD_COPY.openIn(tool) : LIFT_HEAD_COPY.openOriginal}</span>
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      ) : null}
      {menu.length > 0 ? (
        <span className="lift-menu-wrap">
          <button
            type="button"
            className="lift-icon"
            aria-label={LIFT_HEAD_COPY.more}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={LIFT_HEAD_COPY.more}
            onClick={() => onMenuOpenChange(!menuOpen)}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
          {menuOpen ? (
            <span role="menu" className="lift-menu" data-testid="lift-menu">
              {menu.map((entry) => (
                <button
                  key={entry.label}
                  type="button"
                  role="menuitem"
                  className="lift-menu-item"
                  onClick={() => {
                    onMenuOpenChange(false);
                    entry.onSelect();
                  }}
                >
                  {entry.label}
                </button>
              ))}
            </span>
          ) : null}
        </span>
      ) : null}
      <button type="button" className="lift-icon" aria-label={LIFT_HEAD_COPY.back} title={LIFT_HEAD_COPY.back} onClick={onBack}>
        <Minimize2 size={15} aria-hidden="true" />
      </button>
    </>
  );
}
