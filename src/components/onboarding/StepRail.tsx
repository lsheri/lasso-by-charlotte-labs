import { Fragment } from "react";

/**
 * The first-run journey rail from the design system. Three named steps, of
 * which only the first happens inside /onboarding: steps two and three are
 * completed later in the workspace, so they always render as future steps
 * here and `current` is only ever 0 on this route.
 *
 * Measured from Figma "S · /onboarding · Connect one tool" (node 43:511):
 * 20px dots, 10px from dot to label, a 20px 1px rule between steps, Archivo
 * SemiBold 9px numerals, 11.5px labels, SemiBold when active and Regular when
 * future. Active dot is action/primary-bg with an inverse numeral; future dots
 * are unfilled with a 1px line/pencil ring.
 */
const STEPS = ["Connect one tool", "Map your first work", "See your first receipt"] as const;

export function StepRail({ current = 0 }: { current?: number }) {
  return (
    <nav
      className="flex flex-wrap items-center"
      aria-label={`Step ${current + 1} of ${STEPS.length}: ${STEPS[current]}`}
    >
      {STEPS.map((label, index) => {
        const active = index === current;
        return (
          <Fragment key={label}>
            {index > 0 ? <span aria-hidden className="ml-2 mr-3 h-px w-5 bg-pencil" /> : null}
            <span className="flex items-center">
              <span
                aria-hidden
                className={
                  active
                    ? "flex size-5 items-center justify-center rounded-full bg-graphite"
                    : "flex size-5 items-center justify-center rounded-full border border-pencil"
                }
              >
                <span
                  className={
                    active
                      ? "text-[9px] font-semibold leading-none text-nb-white"
                      : "text-[9px] font-semibold leading-none text-soft"
                  }
                >
                  {index + 1}
                </span>
              </span>
              <span
                className={
                  active
                    ? "ml-2.5 text-[11.5px] font-semibold text-foreground"
                    : "ml-2.5 text-[11.5px] text-muted-foreground"
                }
              >
                {label}
              </span>
            </span>
          </Fragment>
        );
      })}
    </nav>
  );
}
