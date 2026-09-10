import { useState, type ReactNode } from "react";

/**
 * Settings as a panel with a section rail, matching the design system's
 * settings screen. Rendered either as a page panel or inside the floating
 * settings dialog (variant="dialog").
 *
 * Every section stays mounted and inactive ones are hidden. DataUseCard fires
 * its consent-presentation note once per mount, guarded by a ref that dies with
 * the mount, so mounting sections on demand would inflate that count on every
 * nav click. Do not make these conditional.
 */
export type SettingsSection = {
  id: string;
  label: string;
  hint: string;
  content: ReactNode;
};

export function SettingsShell({
  sections,
  variant = "page",
}: {
  sections: SettingsSection[];
  variant?: "page" | "dialog";
}) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  const inner = (
    <div
      className={
        variant === "dialog"
          ? "flex h-full flex-col overflow-hidden"
          : "overflow-hidden rounded-[var(--radius)] border border-border bg-card"
      }
    >
      <header className="flex items-baseline justify-between gap-4 border-b border-border px-6 py-5">
        <h1 className="page-title">
          Settings <span className="font-hand">for you</span>
        </h1>
      </header>

      <div className="grid flex-1 overflow-hidden md:grid-cols-[13rem_minmax(0,1fr)]">
        <nav
          aria-label="Settings sections"
          className="flex gap-1 overflow-x-auto border-b border-border p-3 md:flex-col md:overflow-x-visible md:overflow-y-auto md:border-b-0 md:border-r"
        >
          {sections.map((section) => {
            const on = section.id === active;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActive(section.id)}
                aria-current={on ? "true" : undefined}
                className={
                  on
                    ? "shrink-0 rounded-[var(--radius)] bg-secondary px-3 py-2 text-left transition-colors"
                    : "shrink-0 rounded-[var(--radius)] px-3 py-2 text-left transition-colors hover:bg-secondary/60"
                }
              >
                <span className="block whitespace-nowrap text-sm font-medium text-foreground">
                  {section.label}
                </span>
                <span className="mt-0.5 hidden whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground md:block">
                  {section.hint}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 overflow-y-auto p-6">
          {sections.map((section) => (
            <div key={section.id} hidden={section.id !== active} aria-hidden={section.id !== active}>
              {section.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (variant === "dialog") return inner;
  return <div className="mx-auto max-w-4xl">{inner}</div>;
}
