import { useEffect, useRef, useState } from "react";

import { TrailGlyph } from "@/components/reflect/ContextTrail";
import type { ContextManifest } from "@/lib/context-manifest";
import {
  ASK_PHASE_LABEL,
  askPhase,
  askPhaseStep,
  chipLabel,
  freshLine,
  kindChips,
  sameSetLine,
  videoLine,
  whatsNew,
} from "@/lib/ask-reading-v2";

/** V2-2 keyframes live with the component, never in the global stylesheet. */
export const ASK_READING_V2_STYLES = `
.ask-v2-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; height: 2px; }
.ask-v2-steps > span { border-radius: var(--radius-pill); background: var(--border); transition: background 240ms ease-out; }
.ask-v2-steps > span[data-on="true"] { background: var(--ask-live); }
.ask-v2-chip { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 8px; border-radius: var(--radius-pill); border: 1px solid var(--border); font-size: 12px; line-height: 1; color: var(--muted-foreground); white-space: nowrap; }
.ask-v2-chip[data-read="all"] { color: var(--foreground); border-color: color-mix(in srgb, var(--ask-live) 70%, transparent); background: color-mix(in srgb, var(--ask-live) 12%, transparent); }
.ask-v2-chip[data-read="some"] { color: var(--foreground); }
.ask-v2-chip .ask-v2-dot { width: 5px; height: 5px; border-radius: var(--radius-pill); background: var(--ask-live); }
@keyframes ask-v2-shape { 0%, 100% { opacity: .45; } 50% { opacity: .85; } }
.ask-v2-shape > span { display: block; height: 8px; border-radius: var(--radius-pill); background: var(--muted); animation: ask-v2-shape 1800ms ease-in-out infinite; }
.ask-v2-shape > span:nth-child(2) { animation-delay: -600ms; }
.ask-v2-shape > span:nth-child(3) { animation-delay: -1200ms; }
@media (prefers-reduced-motion: reduce) {
  .ask-v2-shape > span { animation: none !important; }
  .ask-v2-steps > span { transition: none !important; }
}
`;

function elapsedLabel(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * V2-2 (ask-v2): what Ask shows while it works. A status word with a three-step
 * line, one chip per kind of work (lime once read), and the answer's shape
 * until the first words arrive. Later turns say only what changed.
 */
export function AskReadingV2({
  manifest,
  previousManifest,
  streamed,
  pickedCount,
  pickedVideos = 0,
}: {
  /** The live manifest from the read frame. Null until the server has assembled the read set. */
  manifest: ContextManifest | null | undefined;
  /** The last answer's manifest in this chat, for "only show what's new". */
  previousManifest?: ContextManifest | null | undefined;
  streamed: string | null | undefined;
  /** How many pieces the person's choice covers, shown while gathering. 0 means the whole board. */
  pickedCount: number;
  /** Videos in the person's pick. Never context, never counted, named "not read". */
  pickedVideos?: number;
}) {
  const mountedAt = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setElapsed(Date.now() - mountedAt.current), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const phase = askPhase({ manifest, streamed });
  const step = askPhaseStep(phase);
  const change = manifest ? whatsNew(manifest, previousManifest) : null;
  const same = manifest && change?.kind === "same" ? sameSetLine(manifest) : null;
  const chips =
    manifest && !same
      ? kindChips(manifest, change?.kind === "changed" ? change.freshIds : undefined)
      : [];
  const fresh = change?.kind === "changed" ? freshLine(change.fresh) : null;
  const videos = videoLine(pickedVideos);

  return (
    <div
      className="text-muted-foreground"
      data-testid="ask-reading-v2"
      data-phase={phase}
      aria-live="polite"
    >
      <style>{ASK_READING_V2_STYLES}</style>
      <div className="flex items-center gap-2 text-[13px]">
        <span className="text-foreground" data-testid="ask-v2-status">
          {ASK_PHASE_LABEL[phase]}
        </span>
        <span className="ml-auto font-mono text-[11px] tabular-nums">{elapsedLabel(elapsed)}</span>
      </div>
      <div className="ask-v2-steps mt-1.5" data-testid="ask-v2-steps" data-step={step} aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} data-on={n <= step ? "true" : "false"} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5" data-testid="ask-v2-chips">
        {manifest ? null : (
          <span className="ask-v2-chip" data-read="none" data-testid="ask-v2-chip">
            <TrailGlyph kind="item" />
            {pickedCount > 0
              ? `${pickedCount} ${pickedCount === 1 ? "piece" : "pieces"} picked`
              : "The whole board"}
          </span>
        )}
        {same ? (
          <span className="text-[12px]" data-testid="ask-v2-same">
            {same}
          </span>
        ) : null}
        {chips.map((chip) => (
          <span
            key={chip.kind}
            className="ask-v2-chip"
            data-testid="ask-v2-chip"
            data-kind={chip.kind}
            data-read={chip.read === chip.count ? "all" : chip.read > 0 ? "some" : "none"}
          >
            <TrailGlyph kind={chip.kind} />
            {chipLabel(chip)}
            {chip.fresh ? (
              <span className="ask-v2-dot" aria-label="new" data-testid="ask-v2-new-dot" />
            ) : null}
          </span>
        ))}
        {fresh ? (
          <span className="text-[12px]" data-testid="ask-v2-fresh">
            {fresh}
          </span>
        ) : null}
        {videos ? (
          <span
            className="ask-v2-chip"
            data-read="none"
            data-kind="video"
            data-testid="ask-v2-video"
          >
            <TrailGlyph kind="video" />
            {videos}
          </span>
        ) : null}
      </div>
      {phase === "writing" ? null : (
        <div className="ask-v2-shape mt-3 space-y-1.5" data-testid="ask-v2-shape" aria-hidden>
          <span style={{ width: "92%" }} />
          <span style={{ width: "78%" }} />
          <span style={{ width: "54%" }} />
        </div>
      )}
    </div>
  );
}
