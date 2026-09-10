import { useEffect, useState } from "react";

import { manifestChips, type ContextManifest } from "@/lib/context-manifest";

/** iOS and macOS honour this; we honour it too. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const MONO = "font-mono text-[11px] leading-relaxed tracking-[0.02em]";

function Tick() {
  return (
    <span aria-hidden className="text-accent-deep">
      {"\u2713"}
    </span>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 shrink-0 animate-spin rounded-full border border-muted-foreground border-t-transparent motion-reduce:animate-none"
    />
  );
}

export type TrailLine = { key: string; text: string };

/**
 * The live trail. Every line is real: the phase lines describe work that is
 * genuinely happening, and the item lines come from the person's own selection
 * until the server sends back what it actually read.
 */
export function ThinkingTrail({
  items,
  finalPhase,
  manifest,
  lead,
}: {
  /** Titles the person selected. Shown before the server answers. */
  items: { id: string; title: string }[];
  /** "Writing…" for chat, "Applying <analysis>…" for an analysis. */
  finalPhase: string;
  /** Once the server responds, the trail switches to the real manifest. */
  manifest?: ContextManifest | null;
  /** The first line. Defaults to the record the person chose. */
  lead?: string | undefined;
}) {
  const reduced = useReducedMotion();
  const lines: TrailLine[] = manifest
    ? [
        ...manifest.items.map((item) => ({
          key: item.id || item.title,
          text: item.detail ? `${item.title} (${item.detail})` : item.title,
        })),
        ...(manifest.brief_included
          ? [
              {
                key: "brief",
                text: manifest.engagement ? `${manifest.engagement.name} brief` : "The brief",
              },
            ]
          : []),
        ...(manifest.firm_checks_applied > 0
          ? [
              {
                key: "checks",
                text:
                  manifest.firm_checks_applied === 1
                    ? "1 firm check"
                    : `${manifest.firm_checks_applied} firm checks`,
              },
            ]
          : []),
      ]
    : items.map((item) => ({ key: item.id, text: item.title }));

  const [shown, setShown] = useState(reduced ? lines.length : 0);
  useEffect(() => {
    if (reduced) {
      setShown(lines.length);
      return;
    }
    if (shown >= lines.length) return;
    const timer = window.setTimeout(() => setShown((n) => n + 1), 150);
    return () => window.clearTimeout(timer);
  }, [shown, lines.length, reduced]);

  const visible = lines.slice(0, Math.max(shown, manifest ? lines.length : shown));

  return (
    <div className={`${MONO} space-y-1 text-muted-foreground`} aria-live="polite">
      <p className="flex items-center gap-2">
        <Tick />
        <span>{lead ?? "Reading the record you chose"}</span>
      </p>
      {visible.map((line, index) => {
        const done = manifest ? true : index < visible.length - 1;
        return (
          <p
            key={line.key}
            className={`flex items-start gap-2 ${reduced ? "" : "animate-in fade-in duration-200"}`}
          >
            {done ? <Tick /> : <Spinner />}
            <span className="min-w-0 break-words">{line.text}</span>
          </p>
        );
      })}
      {manifest?.excluded.map((entry) => (
        <p key={`x-${entry.title}`} className="flex items-start gap-2 opacity-60">
          <span aria-hidden>{"\u00b7"}</span>
          <span className="min-w-0 break-words">
            {entry.title}: {entry.reason}
          </span>
        </p>
      ))}
      <p className="flex items-center gap-2">
        <Spinner />
        <span>{finalPhase}</span>
      </p>
    </div>
  );
}

/**
 * After the answer: one compact line, built only from the persisted manifest.
 * An answer with no manifest recorded shows nothing at all.
 */
export function ContextAudit({
  manifest,
  buttonLabel,
}: {
  manifest: ContextManifest | null;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!manifest) return null;
  const chips = manifestChips(manifest);
  if (chips.length === 0 && manifest.excluded.length === 0) return null;

  return (
    <div className="nb-sticky">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`${MONO} nb-sticky-toggle flex min-h-11 w-full items-start gap-2 text-left`}
      >
        <span aria-hidden>{open ? "\u2212" : "+"}</span>
        <span className="min-w-0 break-words">
          {buttonLabel ?? (chips.length > 0 ? `Read: ${chips.join(" \u00b7 ")}` : "What Lasso read")}
        </span>
      </button>
      {open ? (
        <div className={`${MONO} mt-[1.75rem] border-l border-[#e3d27f] pl-3`}>
          {manifest.engagement ? <p>Engagement: {manifest.engagement.name}</p> : null}
          {manifest.items.length > 0 ? (
            <div>
              <p className="uppercase tracking-[0.08em]">Read</p>
              {manifest.items.map((item) => (
                <p key={item.id || item.title} className="break-words">
                  {item.title}
                  {item.detail ? ` \u00b7 ${item.detail}` : ""}
                  {item.kind && item.kind !== "item" ? ` \u00b7 ${item.kind}` : ""}
                </p>
              ))}
            </div>
          ) : null}
          {manifest.brief_included ? <p>The brief was included.</p> : null}
          {manifest.firm_checks_applied > 0 ? (
            <p>
              {manifest.firm_checks_applied === 1
                ? "1 firm check applied."
                : `${manifest.firm_checks_applied} firm checks applied.`}
            </p>
          ) : null}
          {manifest.excluded.length > 0 ? (
            <div className="opacity-70">
              <p className="uppercase tracking-[0.08em]">Not read</p>
              {manifest.excluded.map((entry) => (
                <p key={entry.title} className="break-words">
                  {entry.title}: {entry.reason}
                </p>
              ))}
            </div>
          ) : null}
          {manifest.assembled_at ? (
            <p className="opacity-70">
              Assembled {new Date(manifest.assembled_at).toLocaleString("en-GB")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
