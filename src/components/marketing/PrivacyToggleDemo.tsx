import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Lock, MessageSquare, Table2 } from "lucide-react";

import { hueStyles } from "@/lib/work-identity";

/**
 * Illustrative only. Hardcoded sample data, no backend. Shows the same work
 * card as its owner sees it and as a coach sees it, where private simply
 * is not rendered.
 */
export function PrivacyToggleDemo() {
  const [coachView, setCoachView] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Flips itself every two seconds while it is on screen, so the difference
  // between the two views reads without anyone touching it.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      (entries) => setAutoplay(entries.some((e) => e.isIntersecting)),
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!autoplay) return;
    const id = window.setInterval(() => setCoachView((v) => !v), 2000);
    return () => window.clearInterval(id);
  }, [autoplay]);

  const conv = hueStyles("--hue-slate-blue");
  const teal = { color: "var(--state-teal)", background: "var(--state-teal-wash)" };
  const indigo = { color: "var(--state-indigo)", background: "var(--state-indigo-wash)" };

  return (
    <div ref={ref}>
      <div className="flex items-center gap-3">
        <span className="micro-label">Owner view</span>
        <button
          type="button"
          role="switch"
          aria-checked={coachView}
          aria-label="Toggle between owner view and coach view"
          onClick={() => setCoachView((v) => !v)}
          className="relative h-6 w-11 rounded-full border border-border transition-colors duration-200"
          style={{ background: coachView ? "var(--ember)" : "var(--secondary)" }}
        >
          <span
            className="absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-[left] duration-200"
            style={{ left: coachView ? "26px" : "4px" }}
          />
        </button>
        <span className="micro-label">Coach view</span>
      </div>

      <div className="mt-5 max-w-xl overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-card transition-all duration-200">
        <div className="border-b border-border px-5 py-4">
          <p className="micro-label">Engagement · Northwind pricing</p>
          <p className="mt-2 text-base font-medium text-foreground">Q3 pricing analysis</p>
        </div>
        <div className="divide-y divide-border">
          <Row
            icon={<MessageSquare className="h-4 w-4" style={{ color: conv.color }} />}
            iconBg={conv.background}
            title="Pricing scenarios, back and forth"
            meta="AI conversation"
          >
            {coachView ? null : (
              <span
                className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{
                  background: "color-mix(in oklab, var(--vendor-claude) 12%, transparent)",
                  color: "var(--vendor-claude)",
                }}
              >
                Claude
              </span>
            )}
          </Row>

          <Row
            icon={<Table2 className="h-4 w-4" style={{ color: "var(--hue-sage)" }} />}
            iconBg="color-mix(in oklab, var(--hue-sage) 12%, transparent)"
            title="Margin model v4"
            meta="Sheet"
          >
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]"
              style={teal}
            >
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              Mapped
            </span>
          </Row>

          <div
            className="grid transition-all duration-200 ease-out"
            style={{ gridTemplateRows: coachView ? "0fr" : "1fr", opacity: coachView ? 0 : 1 }}
            aria-hidden={coachView}
          >
            <div className="overflow-hidden">
              {coachView ? null : (
                <Row
                  icon={<FileText className="h-4 w-4" style={{ color: "var(--hue-sand)" }} />}
                  iconBg="color-mix(in oklab, var(--hue-sand) 12%, transparent)"
                  title="Salary notes for my own read"
                  meta="Document"
                >
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]"
                    style={indigo}
                  >
                    <Lock className="h-3 w-3" aria-hidden />
                    Private
                  </span>
                </Row>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Private means invisible. Shared means chosen. Coaches see exactly what you decide, nothing
        else.
      </p>
    </div>
  );
}

function Row({
  icon,
  iconBg,
  title,
  meta,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  meta: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: iconBg }}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{title}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {meta}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}
