import { Check } from "lucide-react";

import { TOOLS, TOOL_CATEGORIES, type ToolId } from "@/lib/onboarding-tools";
import { ToolBadge } from "./ToolBadge";

export function ToolPicker({
  selected,
  onToggle,
}: {
  selected: Set<ToolId>;
  onToggle: (tool: ToolId) => void;
}) {
  return (
    <div className="space-y-6">
      {TOOL_CATEGORIES.map((category) => (
        <section key={category.title}>
          <h3
            className="rounded-[var(--radius)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em]"
            style={{
              color: `var(${category.hue})`,
              background: `color-mix(in oklab, var(${category.hue}) 10%, transparent)`,
            }}
          >
            {category.title}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {category.tools.map((id) => {
              const meta = TOOLS[id];
              const checked = selected.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => onToggle(id)}
                  className={
                    checked
                      ? "flex items-start gap-3 rounded-[var(--radius)] border border-graphite bg-card p-4 text-left shadow-card ring-1 ring-graphite transition-colors"
                      : "flex items-start gap-3 rounded-[var(--radius)] border border-border bg-card p-4 text-left shadow-card transition-colors hover:border-graphite"
                  }
                >
                  <ToolBadge tool={id} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{meta.label}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{meta.blurb}</span>
                  </span>
                  <span
                    aria-hidden
                    className={
                    checked
                        ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border border-graphite bg-graphite text-nb-white"
                        : "h-5 w-5 shrink-0 rounded-[4px] border border-border"
                    }
                  >
                    {checked ? <Check size={12} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
