import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

import { useSkin } from "@/components/skin/use-skin";
import { EXHIBIT_DASH, EXHIBIT_STROKE } from "@/design/icons/charlotte";
import { CHARLOTTE_KINDS, type CharlotteKindId } from "@/design/icons/charlotte-kinds";

/** The props every work-identity consumer passes to its kind icon. */
export type KindIconProps = { className?: string; style?: CSSProperties; "aria-hidden"?: boolean | "true" | "false" };
export type KindIconComponent = ((props: KindIconProps) => React.JSX.Element) & { lucide: LucideIcon; kind: CharlotteKindId };

const PATHS = new Map(CHARLOTTE_KINDS.map((k) => [k.id, k.d]));

/**
 * Phase 3 PR5: a work kind's icon by skin. Lasso renders the Lucide icon exactly as before (same element, same props);
 * Charlotte draws the Exhibit kind glyph, stroke 1.5 on the 20 grid, in currentColor so the family hue still applies.
 */
export function skinnedKindIcon(Lucide: LucideIcon, kind: CharlotteKindId): KindIconComponent {
  const d = PATHS.get(kind);
  if (!d) throw new Error(`No Charlotte kind glyph for ${kind}`);
  function SkinnedKindIcon(props: KindIconProps) {
    if (useSkin() !== "charlotte") return <Lucide {...props} />;
    return (
      <svg
        data-kind={kind}
        width={24}
        height={24}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={EXHIBIT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {d!.map((p, i) =>
          typeof p === "string" ? <path key={i} d={p} /> : <path key={i} d={p.d} strokeDasharray={EXHIBIT_DASH} />,
        )}
      </svg>
    );
  }
  return Object.assign(SkinnedKindIcon, { lucide: Lucide, kind });
}
