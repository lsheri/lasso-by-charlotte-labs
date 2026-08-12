import { hueStyles } from "@/lib/work-identity";
import { TOOLS, type ToolId } from "@/lib/onboarding-tools";

/** The soft tinted square from the type-identity system, for a tool. */
export function ToolBadge({ tool, size = "md" }: { tool: ToolId; size?: "sm" | "md" }) {
  const meta = TOOLS[tool];
  const Icon = meta.icon;
  const styles = hueStyles(meta.hue);
  const box = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  return (
    <span
      aria-hidden
      className={`flex ${box} shrink-0 items-center justify-center rounded-[calc(var(--radius)-3px)] border`}
      style={{ background: styles.background, borderColor: styles.border, color: styles.color }}
    >
      <Icon size={size === "sm" ? 14 : 16} />
    </span>
  );
}
