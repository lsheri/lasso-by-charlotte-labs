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
    <div className="lasso-tool-picker after-tools space-y-6">
      {TOOL_CATEGORIES.map((category) => (
        <section key={category.title}>
          <h3 className="after-tools-band" style={{ ["--band" as string]: `var(${category.hue})` }}>
            <span aria-hidden className="after-tools-dot" />
            {category.title}
          </h3>
          <div className="after-tools-grid">
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
                  className={checked ? "after-tool is-on" : "after-tool"}
                  style={{ ["--tool" as string]: `var(${meta.hue})` }}
                >
                  <span aria-hidden className="after-tool-tick">
                    {checked ? <Check size={11} /> : null}
                  </span>
                  <ToolBadge tool={id} />
                  <span className="after-tool-label">{meta.label}</span>
                  <span className="after-tool-scope">{meta.scope ?? meta.blurb}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
