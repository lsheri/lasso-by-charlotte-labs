import { useEffect, useRef, useState } from "react";

import { LassoThinkingMark } from "@/components/reflect/LassoThinkingMark";
import { Button } from "@/components/ui/button";
import { emitClientEvent } from "@/lib/client-telemetry";
import type { ContextManifest, ManifestKind } from "@/lib/context-manifest";
import { bucket } from "@/lib/telemetry-shared";

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

export type TrailLine = { key: string; text: string };

type DisplayLine = TrailLine & {
  kind: ManifestKind | "checks";
  detail?: string;
};

function TrailGlyph({ kind }: { kind: DisplayLine["kind"] }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.35,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    vectorEffect: "non-scaling-stroke" as const,
  };
  const paths: Record<DisplayLine["kind"], React.ReactNode> = {
    conversation: <><path {...common} d="M3 3.5h10v7H7l-3.5 2v-2H3z" /><circle cx="6" cy="7" r=".55" fill="currentColor" /><circle cx="8" cy="7" r=".55" fill="currentColor" /><circle cx="10" cy="7" r=".55" fill="currentColor" /></>,
    document: <><path {...common} d="M4 1.8h5.5L12.5 5v9.2H4z" /><path {...common} d="M9.5 1.8V5h3M6 8h4.5M6 10.5h4.5" /></>,
    deck: <><rect {...common} x="2.5" y="3" width="11" height="8" rx=".7" /><path {...common} d="M6 14h4M8 11v3M5 8l2-2 1.5 1.5L11 5" /></>,
    sheet: <><rect {...common} x="2.5" y="2" width="11" height="12" rx=".6" /><path {...common} d="M2.5 6h11M6.2 2v12M10 2v12M2.5 10h11" /></>,
    email: <><rect {...common} x="2" y="3.2" width="12" height="9.5" rx=".8" /><path {...common} d="m2.5 4 5.5 4.5L13.5 4" /></>,
    note: <><path {...common} d="M3.5 2h9v9l-3 3h-6z" /><path {...common} d="M9.5 14v-3h3M5.5 5.5h5M5.5 8h4" /></>,
    transcript: <><path {...common} d="M3 3h10M3 6h7M3 9h9M3 12h6" /></>,
    brief: <><path {...common} d="M3.5 2h7l2 2v10h-9zM6 6h4M6 8.5h4M6 11h2.5" /><path {...common} d="M10.5 2v2h2" /></>,
    item: <><rect {...common} x="3" y="3" width="10" height="10" rx="1" /><path {...common} d="M5.5 6h5M5.5 8.5h5M5.5 11h3" /></>,
    checks: <><path {...common} d="m2.5 5 2 2 3-3M8.5 5h5M2.5 11l2 2 3-3M8.5 11h5" /></>,
  };
  const motionClass = kind === "conversation" ? "nb-trail-glyph-conversation" : kind === "document" || kind === "deck" || kind === "sheet" || kind === "email" || kind === "transcript" || kind === "item" ? "nb-trail-glyph-document" : kind === "note" ? "nb-trail-glyph-pen" : kind === "brief" ? "nb-trail-glyph-brief" : kind === "checks" ? "nb-trail-glyph-search" : "";
  return <span aria-hidden className="flex size-4 shrink-0 items-center justify-center bg-background"><svg viewBox="0 0 16 16" className={`size-4 ${motionClass}`}>{paths[kind]}</svg></span>;
}

function elapsedLabel(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The live trail. Selection titles are provisional until the server returns
 * the persisted manifest, which becomes the only source of read rows.
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
  const mountedAt = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const nextLines: DisplayLine[] = manifest
    ? [
        ...manifest.items.map((item) => ({ key: item.id || item.title, text: item.title, detail: item.detail, kind: item.kind })),
        ...(manifest.brief_included ? [{ key: "brief", text: "The brief", detail: manifest.engagement?.name, kind: "brief" as const }] : []),
        ...(manifest.firm_checks_applied > 0 ? [{ key: "checks", text: `${manifest.firm_checks_applied} firm ${manifest.firm_checks_applied === 1 ? "check" : "checks"}`, kind: "checks" as const }] : []),
      ].slice(-3)
    : items.map((item) => ({ key: item.id, text: item.title, kind: "item" as const })).slice(-3);
  const signature = nextLines.map((line) => `${line.key}:${line.text}:${line.detail ?? ""}`).join("|");
  const [shown, setShown] = useState(nextLines);
  const shownSignature = useRef(signature);

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed(Date.now() - mountedAt.current), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (shownSignature.current === signature) return;
    shownSignature.current = signature;
    if (reduced) {
      setShown(nextLines);
      setLeaving(false);
      return;
    }
    setLeaving(true);
    const timer = window.setTimeout(() => {
      setShown(nextLines);
      setLeaving(false);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [reduced, signature]);

  void lead;
  return (
    <div className="text-muted-foreground" aria-live="polite">
      {manifest ? (
        <p className="mb-2 text-[13px] leading-5">
          Read {manifest.items.length} pieces of work
          {manifest.brief_included ? ", the brief" : ""}
          {manifest.firm_checks_applied > 0 ? `, ${manifest.firm_checks_applied} firm checks` : ""}
        </p>
      ) : null}
      <div className="relative h-[102px]" data-testid="thinking-trail-rows">
        <span aria-hidden className="absolute bottom-[17px] left-[7.5px] top-[17px] w-px bg-border" />
        <div className={reduced ? "" : leaving ? "nb-trail-window-leave" : "nb-trail-window-enter"}>
          {shown.map((line, index) => (
            <p
              key={line.key}
              className={`nb-trail-row relative flex h-[34px] items-center text-[13px] leading-none text-foreground ${index === shown.length - 1 ? "live" : ""}`}
              data-trail-state={manifest ? "read" : "pending"}
            >
              <TrailGlyph kind={line.kind} />
              <span className="ml-[9px] min-w-0 truncate">{line.text}</span>
              {line.detail ? <span className="ml-[7px] shrink-0 text-[12px] text-muted-foreground">{line.detail}</span> : null}
            </p>
          ))}
        </div>
      </div>
      <div className="mt-2 flex h-5 items-center gap-2 text-[13px] text-muted-foreground">
        <LassoThinkingMark kind="signature" size={20} className="shrink-0 text-[var(--nb-lasso-green)]" />
        <span>{manifest ? finalPhase : "Reading your work"}</span>
        <span aria-hidden>·</span>
        <span className="font-mono text-[11px]">{elapsedLabel(elapsed)}</span>
      </div>
    </div>
  );
}

function AuditGlyph({ kind }: { kind: ManifestKind | "brief" | "checks" }) {
  return <TrailGlyph kind={kind} />;
}

/** After the answer: a closed disclosure line backed by the persisted manifest. */
export function ContextAudit({
  manifest,
  buttonLabel,
}: {
  manifest: ContextManifest | null;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  if (!manifest) return null;
  const total = manifest.items.length + (manifest.brief_included ? 1 : 0) + (manifest.firm_checks_applied > 0 ? 1 : 0) + manifest.excluded.length;

  const toggle = () => {
    setOpen((current) => {
      if (!current) {
        emitClientEvent("reflect.trail_opened", {
          read_band: bucket(manifest.items.length),
          also_in_band: bucket((manifest.brief_included ? 1 : 0) + (manifest.firm_checks_applied > 0 ? 1 : 0)),
          not_read_band: bucket(manifest.excluded.length),
        });
      }
      return !current;
    });
  };

  return (
    <div className={`text-foreground ${reduced ? "" : "nb-audit-settle"}`}>
      <Button type="button" variant="ghost" onClick={toggle} aria-expanded={open} className="h-[30px] w-full justify-start gap-2 px-0 text-left text-[13px] font-normal hover:bg-transparent">
        <span aria-hidden className={`inline-block text-[11px] text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`}>›</span>
        <span className="min-w-0 truncate">{buttonLabel ?? "Read what went into this response"}</span>
        <span className="font-mono text-[10.5px] text-muted-foreground">{total}</span>
      </Button>
      {open ? (
        <div className="space-y-4 pb-1 pt-3 text-[13px]">
          <section data-audit-group="read">
            <h4 className="mb-2 font-mono text-[8.5px] uppercase text-muted-foreground tracking-[0.08em]">Read</h4>
            <div className="space-y-2">
              {manifest.items.map((item) => <p key={item.id || item.title} className="flex min-w-0 items-center"><AuditGlyph kind={item.kind} /><span className="ml-[9px] min-w-0 break-words">{item.title}</span>{item.detail ? <span className="ml-[7px] text-[12px] text-muted-foreground">{item.detail}</span> : null}</p>)}
            </div>
          </section>
          {manifest.brief_included || manifest.firm_checks_applied > 0 ? (
            <section data-audit-group="also-in">
              <h4 className="mb-2 font-mono text-[8.5px] uppercase text-muted-foreground tracking-[0.08em]">Also in</h4>
              <div className="space-y-2">
                {manifest.brief_included ? <p className="flex items-center"><AuditGlyph kind="brief" /><span className="ml-[9px]">The brief</span>{manifest.engagement?.name ? <span className="ml-[7px] text-[12px] text-muted-foreground">{manifest.engagement.name}</span> : null}</p> : null}
                {manifest.firm_checks_applied > 0 ? <p className="flex items-center"><AuditGlyph kind="checks" /><span className="ml-[9px]">{manifest.firm_checks_applied} firm {manifest.firm_checks_applied === 1 ? "check" : "checks"}</span></p> : null}
              </div>
            </section>
          ) : null}
          <section data-audit-group="not-read">
            <h4 className="mb-2 font-mono text-[8.5px] uppercase text-muted-foreground tracking-[0.08em]">Not read</h4>
            <div className="space-y-2 opacity-[0.62]">
              {manifest.excluded.map((entry) => <p key={`${entry.title}:${entry.reason}`} className="flex min-w-0 items-start"><span aria-hidden className="mt-[7px] h-px w-1 shrink-0 bg-current" /><span className="ml-[9px] break-words">{entry.title}<span className="text-muted-foreground"> {" - "}{entry.reason}</span></span></p>)}
            </div>
          </section>
          {manifest.assembled_at ? <p className="font-mono text-[10px] uppercase text-muted-foreground opacity-60 tracking-[0.04em]">Assembled {new Date(manifest.assembled_at).toLocaleString("en-GB")}</p> : null}
        </div>
      ) : null}
    </div>
  );
}