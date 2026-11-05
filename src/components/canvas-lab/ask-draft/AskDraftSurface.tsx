import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

import { AskSurface } from "@/components/reflect/AskSurface";
import type { AskLasso } from "@/components/reflect/use-ask-lasso";
import type { AskTab } from "@/components/reflect/ask-dock-state";
import type { AskSectionChoice } from "@/components/canvas-lab/BoardAsk";
import { noteWorkboardAskMoved } from "@/components/canvas-lab/canvas-lab-telemetry";
import {
  ASK_DRAFT_WIDTH, askDropTargets, clampFree, readAskPosition, resolveAskDrop, writeAskPosition,
  type AskDraft, type AskDraftPosition, type SavedAskPosition,
} from "@/lib/ask-draft";

function safeStore(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

type Props = {
  draft: AskDraft;
  host: HTMLElement;
  ask: AskLasso;
  tab: AskTab;
  onTab: (tab: AskTab) => void;
  engagementId: string;
  engagementTitle: string;
  profileId: string;
  orgId: string;
  onClose: () => void;
  sections?: AskSectionChoice[] | undefined;
  onPickSection?: ((frameId: string) => void) | undefined;
};

/** ASK-D1: Ask Lasso floating over the board. Preview-gated draft a or b. */
export function AskDraftSurface(props: Props) {
  const { draft, host, ask } = props;
  const [pos, setPos] = useState<SavedAskPosition>(() => readAskPosition(draft, safeStore()));
  const [size, setSize] = useState({ w: host.clientWidth, h: host.clientHeight });
  const [drag, setDrag] = useState<{ hover: AskDraftPosition; x: number; y: number } | null>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);

  useLayoutEffect(() => {
    const update = () => setSize({ w: host.clientWidth, h: host.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(host);
    return () => ro.disconnect();
  }, [host]);

  // Locked: tell the floating toolbar where the visible canvas is.
  useEffect(() => {
    const locked = pos.to === "lock_left" || pos.to === "lock_right";
    if (!locked) return;
    const offset = `${ASK_DRAFT_WIDTH.lock_left + 12}px`;
    host.dataset.askLock = pos.to;
    host.style.setProperty(pos.to === "lock_left" ? "--ask-draft-lock-left" : "--ask-draft-lock-right", offset);
    return () => {
      delete host.dataset.askLock;
      host.style.removeProperty("--ask-draft-lock-left");
      host.style.removeProperty("--ask-draft-lock-right");
    };
  }, [host, pos.to]);

  const local = (event: ReactPointerEvent) => {
    const r = host.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  };

  const onGripDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const surface = (event.currentTarget.closest(".ask-draft") as HTMLElement).getBoundingClientRect();
    grab.current = { dx: event.clientX - surface.left, dy: event.clientY - surface.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = local(event);
    setDrag({ hover: resolveAskDrop(p.x, p.y, size.w, size.h), x: p.x, y: p.y });
  };
  const onGripMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!grab.current) return;
    const p = local(event);
    setDrag({ hover: resolveAskDrop(p.x, p.y, size.w, size.h), x: p.x, y: p.y });
  };
  const onGripUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!grab.current) return;
    const p = local(event);
    const to = resolveAskDrop(p.x, p.y, size.w, size.h);
    const next: SavedAskPosition = to === "free"
      ? { to, ...clampFree(p.x - grab.current.dx, p.y - grab.current.dy, size.w, size.h) }
      : { to };
    grab.current = null;
    setDrag(null);
    setPos(next);
    writeAskPosition(draft, next, safeStore());
    noteWorkboardAskMoved(props.orgId, to, draft);
  };

  const collapsed = props.tab === "messages" && (ask.messages ?? []).length === 0;
  const locked = pos.to === "lock_left" || pos.to === "lock_right";
  const style = surfaceStyle(pos, size.w, size.h);
  const targets = askDropTargets(size.w, size.h);

  return createPortal(
    <>
      {drag ? (
        <div className="ask-draft-targets" aria-hidden="true">
          {(Object.keys(targets) as Array<keyof typeof targets>).map((key) => {
            const r = targets[key];
            return <span key={key} data-target={key} data-hover={drag.hover === key ? "true" : undefined} style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />;
          })}
        </div>
      ) : null}
      <section
        aria-label="Ask Lasso"
        className={`ask-draft ask-draft-${draft}`}
        data-position={pos.to}
        data-collapsed={collapsed ? "true" : undefined}
        data-locked={locked ? "true" : undefined}
        data-dragging={drag ? "true" : undefined}
        style={style}
        onPointerDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <div className="ask-draft-head">
          <button
            type="button"
            className="ask-draft-grip"
            aria-label="Move Ask Lasso"
            onPointerDown={onGripDown}
            onPointerMove={onGripMove}
            onPointerUp={onGripUp}
            onPointerCancel={() => { grab.current = null; setDrag(null); }}
          >
            <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
              {[2, 8, 14].flatMap((cy) => [2, 8].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" fill="currentColor" />))}
            </svg>
          </button>
          <span className="ask-draft-title">Ask Lasso</span>
          <button type="button" className="ask-draft-head-btn ask-draft-new" onClick={() => { ask.newSession(); props.onTab("messages"); }}>New ask</button>
          <button type="button" className="ask-draft-head-btn" aria-pressed={props.tab === "history"} onClick={() => props.onTab(props.tab === "history" ? "messages" : "history")}>History</button>
        </div>
        <div className="ask-draft-body">
          <AskSurface
            ask={ask}
            tab={props.tab}
            onTab={props.onTab}
            engagementId={props.engagementId}
            engagementTitle={props.engagementTitle}
            profileId={props.profileId}
            orgId={props.orgId}
            onClose={props.onClose}
            headerTone="lime"
            inline
            sections={props.sections}
            onPickSection={props.onPickSection}
          />
        </div>
      </section>
    </>,
    host,
  );
}

export function surfaceStyle(pos: SavedAskPosition, w: number, h: number): CSSProperties {
  switch (pos.to) {
    case "bottom_centre": {
      const width = Math.min(ASK_DRAFT_WIDTH.bottom_centre, w - 32);
      return { width, left: Math.max(16, (w - width) / 2), bottom: 16, maxHeight: h * 0.74 };
    }
    case "bottom_right":
      return { width: Math.min(ASK_DRAFT_WIDTH.bottom_right, w - 32), right: 16, bottom: 16, maxHeight: h * 0.74 };
    case "lock_left":
      return { width: ASK_DRAFT_WIDTH.lock_left, left: 12, top: 12, bottom: 12 };
    case "lock_right":
      return { width: ASK_DRAFT_WIDTH.lock_right, right: 12, top: 12, bottom: 12 };
    case "free": {
      const width = Math.min(ASK_DRAFT_WIDTH.free, w);
      const { x, y } = clampFree(pos.x ?? 16, pos.y ?? 16, w, h, width);
      return { width, left: x, top: y, maxHeight: Math.max(120, Math.min(h * 0.74, h - y - 12)) };
    }
  }
}
