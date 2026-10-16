import { BrandLogo } from "@/components/connectors/BrandLogo";
import { hueStyles } from "@/lib/work-identity";
import { TOOLS, type ToolId } from "@/lib/onboarding-tools";
import { brandForTool } from "@/lib/tool-brand";

/**
 * The soft tinted square from the type-identity system, for a tool.
 *
 * Reference component eleven. The catalogue was frozen at ten; this is the
 * "add when an experiment needs one" case, used once, on purpose, because
 * production was rendering every tool as a coloured dot and the fix needed a
 * reference to port against.
 *
 * Container decided 16 Oct: the soft tinted square stays. A plain white
 * square with a hairline and a bare mark with no container were both built
 * and both lost. The wash is the only thing tying the badge to the hue its
 * own category header already carries, and a fixed box keeps marks of very
 * different widths from bouncing the label baseline.
 *
 * Radius is --radius-md-new, the system token. The app previously asked for
 * calc(var(--radius) - 3px), an 8px shadcn leftover that is defined in
 * styles.css and in neither tokens.css nor the design system, and that landed
 * on the right 5px only by coincidence.
 */
export function ToolBadge({ tool, size = "md" }: { tool: ToolId; size?: "sm" | "md" }) {
  const meta = TOOLS[tool];
  const Icon = meta.icon;
  const styles = hueStyles(meta.hue);
  const box = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const brand = brandForTool(tool);
  return (
    <span
      aria-hidden
      className={`flex ${box} shrink-0 items-center justify-center rounded-[var(--radius-md-new)] border`}
      style={{ background: styles.background, borderColor: styles.border, color: styles.color }}
    >
      {brand ? (
        <BrandLogo brand={brand} size={size === "sm" ? 15 : 18} />
      ) : (
        <Icon size={size === "sm" ? 14 : 16} />
      )}
    </span>
  );
}
