import { useEffect, useRef, useState } from "react";

import { LassoThinkingMark } from "@/components/reflect/LassoThinkingMark";
import { ThreadViewerById } from "@/components/work/ThreadViewerById";
import { Button } from "@/components/ui/button";
import { emitClientEvent } from "@/lib/client-telemetry";
import type { ContextManifest, ManifestKind } from "@/lib/context-manifest";
import type { ContextSource } from "@/lib/reflect-shared";
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
    checks: <><circle {...common} cx="7" cy="7" r="4" /><path {...common} d="m10 10 3.2 3.2" /></>,
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
        ...(manifest.brief_included ? [{ key: "brief", text: "The brief", ...(manifest.engagement?.name ? { detail: manifest.engagement.name } : {}), kind: "brief" as const }] : []),
        ...(manifest.firm_checks_applied > 0 ? [{ key: "checks", text: `${manifest.firm_checks_applied} firm ${manifest.firm_checks_applied === 1 ? "check" : "checks"}`, kind: "checks" as const }] : []),
      ].slice(-3)
    : items.slice(0, 3).map((item) => ({ key: item.id, text: item.title, kind: "item" as const }));
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
    <div className="nb-answer-rail text-muted-foreground" data-rail-state="working" aria-live="polite">
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
        <LassoThinkingMark kind="loop" size={20} className="shrink-0 text-[var(--nb-lasso-green)]" />
        <span>{manifest ? finalPhase : "Reading your work"}</span>
        <span aria-hidden>·</span>
        <span className="font-mono text-[11px]">{elapsedLabel(elapsed)}</span>
      </div>
    </div>
  );
}

/**
 * One rail for the life of an answer: lime while Lasso works, hairline once
 * the answer is in. Children (trail, answer, footer) sit beside it.
 */
export function AnswerRail({ state, children }: { state: "working" | "done"; children: React.ReactNode }) {
  return (
    <div className="nb-answer-rail" data-rail-state={state} data-testid="answer-rail">
      {children}
    </div>
  );
}

/** How deeply a piece of work was read, as a short row detail. */
export const READ_DEPTH_DETAIL: Record<ContextSource["depth"], string> = {
  full: "read in full",
  extract: "summary only",
  catalogue: "listed, not opened",
  unreadable: "could not be read",
};

type AuditReadRow = { key: string; title: string; kind: ManifestKind; detail: string; openId: string | null };

function auditReadRows(manifest: ContextManifest, reads: ContextSource[]): AuditReadRow[] {
  const byId = new Map(reads.map((read) => [read.id, read]));
  const matched = new Set<string>();
  const rows: AuditReadRow[] = manifest.items.map((item) => {
    const read = item.id ? byId.get(item.id) : undefined;
    if (read) matched.add(read.id);
    return {
      key: item.id || item.title,
      title: item.title,
      kind: item.kind,
      detail: read ? READ_DEPTH_DETAIL[read.depth] : item.detail,
      openId: read ? read.id : null,
    };
  });
  for (const read of reads) {
    if (matched.has(read.id)) continue;
    rows.push({ key: `read:${read.id}`, title: read.title, kind: "item", detail: READ_DEPTH_DETAIL[read.depth], openId: read.id });
  }
  return rows;
}

function AuditGlyph({ kind }: { kind: ManifestKind | "brief" | "checks" }) {
  return <TrailGlyph kind={kind} />;
}

/** After the answer: a closed disclosure line backed by the persisted manifest. */
export function ContextAudit({
  manifest: givenManifest,
  buttonLabel,
  reads = [],
}: {
  manifest: ContextManifest | null;
  buttonLabel?: string;
  /** What the answer read and how deeply. Merged into the READ group. */
  reads?: ContextSource[];
}) {
  const [open, setOpen] = useState(false);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const reduced = useReducedMotion();
  if (!givenManifest && reads.length === 0) return null;
  const manifest: ContextManifest = givenManifest ?? { engagement: null, brief_included: false, firm_checks_applied: 0, items: [], excluded: [], assembled_at: "" };
  const readRows = auditReadRows(manifest, reads);
  const total = readRows.length + (manifest.brief_included ? 1 : 0) + (manifest.firm_checks_applied > 0 ? 1 : 0) + manifest.excluded.length;

  const toggle = () => {
    setOpen((current) => {
      if (!current) {
        emitClientEvent("reflect.trail_opened", {
          read_band: bucket(readRows.length),
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
          {readRows.length > 0 ? (
            <section data-audit-group="read">
              <h4 className="mb-2 font-mono text-[8.5px] uppercase text-muted-foreground tracking-[0.08em]">Read</h4>
              <div className="space-y-2">
                {readRows.map((row) => (
                  <p key={row.key} className="flex min-w-0 items-center" data-audit-row={row.key}>
                    <AuditGlyph kind={row.kind} />
                    {row.openId ? (
                      <button type="button" onClick={() => setOpenItem(row.openId)} className="ml-[9px] min-w-0 break-words text-left hover:underline">{row.title}</button>
                    ) : (
                      <span className="ml-[9px] min-w-0 break-words">{row.title}</span>
                    )}
                    {row.detail ? <span className="ml-[7px] text-[12px] text-muted-foreground" data-audit-detail>{row.detail}</span> : null}
                  </p>
                ))}
              </div>
            </section>
          ) : null}
          {manifest.brief_included || manifest.firm_checks_applied > 0 ? (
            <section data-audit-group="also-in">
              <h4 className="mb-2 font-mono text-[8.5px] uppercase text-muted-foreground tracking-[0.08em]">Also in</h4>
              <div className="space-y-2">
                {manifest.brief_included ? <p className="flex items-center"><AuditGlyph kind="brief" /><span className="ml-[9px]">The brief</span>{manifest.engagement?.name ? <span className="ml-[7px] text-[12px] text-muted-foreground">{manifest.engagement.name}</span> : null}</p> : null}
                {manifest.firm_checks_applied > 0 ? <p className="flex items-center"><AuditGlyph kind="checks" /><span className="ml-[9px]">{manifest.firm_checks_applied} firm {manifest.firm_checks_applied === 1 ? "check" : "checks"}</span></p> : null}
              </div>
            </section>
          ) : null}
          {manifest.excluded.length > 0 ? (
            <section data-audit-group="not-read">
              <h4 className="mb-2 font-mono text-[8.5px] uppercase text-muted-foreground tracking-[0.08em]">Not read</h4>
              <div className="space-y-2 opacity-[0.62]">
                {manifest.excluded.map((entry) => <p key={`${entry.title}:${entry.reason}`} className="flex min-w-0 items-start"><span aria-hidden className="mt-[7px] h-px w-1 shrink-0 bg-current" /><span className="ml-[9px] break-words">{entry.title}<span className="text-muted-foreground"> {" - "}{entry.reason}</span></span></p>)}
              </div>
            </section>
          ) : null}
          {manifest.assembled_at ? <p className="font-mono text-[10px] uppercase text-muted-foreground opacity-60 tracking-[0.04em]">Assembled {new Date(manifest.assembled_at).toLocaleString("en-GB")}</p> : null}
        </div>
      ) : null}
      {openItem ? <ThreadViewerById workItemId={openItem} onClose={() => setOpenItem(null)} /> : null}
    </div>
  );
}