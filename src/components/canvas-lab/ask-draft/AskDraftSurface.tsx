import { useCallback, useEffect, useState, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronsDownUp, ChevronsUpDown, History, X } from "lucide-react";

import { AskSurface } from "@/components/reflect/AskSurface";
import type { AskLasso } from "@/components/reflect/use-ask-lasso";
import type { AskTab } from "@/components/reflect/ask-dock-state";
import type { AskSectionChoice } from "@/components/canvas-lab/BoardAsk";
import { AskPastList, type PinnedAnswerRow } from "@/components/canvas-lab/ask-draft/AskPastList";
import { noteWorkboardAskMoved, noteWorkboardAskView } from "@/components/canvas-lab/canvas-lab-telemetry";
import { AskPlacingGhost } from "@/components/canvas-lab/ask-draft/AskPlacing";
import { AskReadingLines } from "@/components/canvas-lab/ask-draft/AskReadingLines";
import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { readAskPosition, writeAskPosition, type AskDraft } from "@/lib/ask-draft";
import { ASK_DOCK_CONFIG, DOCK_SPOTS, useAskDock, type DockId } from "@/lib/ask-dock-engine";

function safeStore(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/** The free spot's saved corner, read back from the transform the engine paints. */
function readFree(el: HTMLElement): { x: number; y: number } {
  const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(el.style.transform);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 240, y: 200 };
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
  pinnedAnswers?: PinnedAnswerRow[] | undefined;
  onJumpToAnswer?: ((nodeId: string) => void) | undefined;
  /** ASK-LOOK-1: board node ids of the picked cards Lasso reads, for draft b's reading lines. */
  readingNodeIds?: string[] | undefined;
};

const FOOT_H = 34;

const HEADER_H = 46;

/** ASK-B1: Ask Lasso floating over the board, carried by the dock engine. Preview-gated. */
export function AskDraftSurface(props: Props) {
  const { draft, host, ask } = props;
  const bodyRef = useRef<HTMLDivElement>(null);
  const initial = useRef(readAskPosition(draft, safeStore())).current;
  const [folded, setFolded] = useState(false);
  const [, setLinesShowing] = useState(false);
  const empty = props.tab === "messages" && (ask.messages ?? []).length === 0;
  const collapsed = empty || folded;
  const foldedRef = useRef(folded);
  foldedRef.current = folded;

  const contentHeight = useCallback(() => {
    const body = bodyRef.current;
    if (!body || body.children.length === 0) return 160;
    let total = HEADER_H;
    for (const child of Array.from(body.children) as HTMLElement[]) {
      const cs = getComputedStyle(child);
      if (cs.display === "none") continue;
      const inner = child.classList.contains("nb-binder")
        ? ((child.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0)
        : child.hasAttribute("data-ask-list")
          ? ((child.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0)
          : child.offsetHeight;
      total += inner + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
    }
    if (!foldedRef.current) total += FOOT_H;
    const shell = body.parentElement;
    if (shell) total += shell.offsetHeight - shell.clientHeight;
    return total;
  }, []);

  const topInset = useCallback(
    () => (host.querySelector('[data-testid="shared-space-band"]') as HTMLElement | null)?.offsetHeight ?? 0,
    [host],
  );

  const dock = useAskDock({
    host,
    initial,
    contentHeight,
    topInset,
    initialHeight: initial.h ?? null,
    fitLock: () => foldedRef.current,
    onLand: (to, free) => {
      savePosition(to, free);
      noteWorkboardAskMoved(props.orgId, to, draft);
    },
  });

  // ASK-B3: one save path, so a resize keeps the position and a move keeps the height.
  const userHRef = useRef<number | null>(initial.h ?? null);
  const lastPos = useRef<{ to: DockId; free: { x: number; y: number } }>({ to: initial.to, free: { x: initial.x ?? 240, y: initial.y ?? 200 } });
  function savePosition(to: DockId, free: { x: number; y: number }) {
    lastPos.current = { to, free };
    const h = userHRef.current;
    writeAskPosition(draft, {
      to,
      ...(to === "free" ? { x: free.x, y: free.y } : {}),
      ...(h != null ? { h } : {}),
    }, safeStore());
  }
  const minHeight = () => { const composer = bodyRef.current?.querySelector<HTMLElement>("div.sticky"); return HEADER_H + FOOT_H + 2 + (composer ? composer.offsetHeight + 16 : 96); };
  const maxHeight = () => (host.clientHeight || 0) - ASK_DOCK_CONFIG.insets.bottom - ASK_DOCK_CONFIG.toolbarClear - topInset();
  const saveHeight = (h: number | null) => {
    userHRef.current = h;
    const el = dock.surfaceRef.current;
    const free = dock.dock === "free" && el ? readFree(el) : lastPos.current.free;
    savePosition(dock.dock, free);
  };
  const drag = useRef<{ startY: number; start: number; raw: number; edge: "top" | "bottom"; logged: boolean } | null>(null);
  const edgeDown = (edge: "top" | "bottom") => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* the pointer is already gone */ }
    const start = dock.height();
    drag.current = { startY: event.clientY, start, raw: start, edge, logged: false };
  };
  const edgeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    event.stopPropagation();
    const dy = event.clientY - d.startY;
    d.raw = d.start + (d.edge === "top" ? -dy : dy);
    if (!d.logged && Math.abs(dy) > 2) { d.logged = true; noteWorkboardAskView(props.orgId, "resized", draft); }
    dock.setHeight(Math.max(d.raw, minHeight()), d.edge);
  };
  const edgeUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    event.stopPropagation();
    if (d.raw < minHeight() - 40) { dock.setHeight(null); saveHeight(null); setFolded(true); return; }
    if (d.logged) saveHeight(dock.height());
  };
  const edgeKey = (edge: "top" | "bottom") => (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Home") { event.preventDefault(); dock.setHeight(null); saveHeight(null); return; }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const longer = edge === "top" ? event.key === "ArrowUp" : event.key === "ArrowDown";
    dock.setHeight(Math.max(dock.height() + (longer ? 24 : -24), minHeight()), edge);
    saveHeight(dock.height());
    noteWorkboardAskView(props.orgId, "resized", draft);
  };

  // Unfold when a read starts and when history opens.
  useEffect(() => { if (ask.pending) setFolded(false); }, [ask.pending]);
  useEffect(() => { if (props.tab === "history") setFolded(false); }, [props.tab]);
  // ASK-B2a: a picked-cards picker or a failed send needs room to show.
  useEffect(() => { if (ask.pickerOpen || ask.error) setFolded(false); }, [ask.pickerOpen, ask.error]);

  const { refresh } = dock;

  // Content changes size: re-measure the body and the binder's scroll content.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const ro = new ResizeObserver(() => refresh());
    ro.observe(body);
    const binderBody = body.querySelector(".nb-binder-body");
    if (binderBody) ro.observe(binderBody);
    const listInner = body.querySelector("[data-ask-list] > div");
    if (listInner) ro.observe(listInner);
    return () => ro.disconnect();
  }, [refresh, ask.messages, props.tab]);

  useLayoutEffect(() => { refresh(); }, [refresh, collapsed, folded]);

  const place: DockId = dock.hover ?? dock.dock;
  const locked = place === "lock_left" || place === "lock_right";

  // Locked: tell the floating toolbar where the visible canvas is.
  useEffect(() => {
    if (place !== "lock_left" && place !== "lock_right") return;
    const offset = `${ASK_DOCK_CONFIG.widths.lock + 12}px`;
    host.setAttribute("data-ask-lock", place);
    host.style.setProperty(place === "lock_left" ? "--ask-draft-lock-left" : "--ask-draft-lock-right", offset);
    return () => {
      host.removeAttribute("data-ask-lock");
      host.style.removeProperty("--ask-draft-lock-left");
      host.style.removeProperty("--ask-draft-lock-right");
    };
  }, [host, place]);

  const edgeProps = (edge: "top" | "bottom") => ({
    className: "ask-draft-edge",
    "data-edge": edge,
    "data-no-drag": "",
    role: "separator",
    "aria-orientation": "horizontal" as const,
    "aria-label": "Make Ask Lasso longer or shorter",
    tabIndex: 0,
    "aria-valuemin": Math.round(minHeight()),
    "aria-valuemax": Math.max(Math.round(minHeight()), Math.round(maxHeight())),
    "aria-valuenow": Math.round(dock.height()),
    onPointerDown: edgeDown(edge),
    onPointerMove: edgeMove,
    onPointerUp: edgeUp,
    onPointerCancel: edgeUp,
    onDoubleClick: () => { dock.setHeight(null); saveHeight(null); },
    onKeyDown: edgeKey(edge),
  });
  const showEdges = !locked && !folded && !empty;

  const onGripKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const to: DockId | null = event.key === "ArrowLeft" ? "lock_left"
      : event.key === "ArrowRight" ? "lock_right"
        : event.key === "ArrowDown" ? "bottom_centre"
          : event.key === "ArrowUp" ? "bottom_right"
            : null;
    if (!to) return;
    event.preventDefault();
    dock.moveTo(to);
  };

  return createPortal(
    <>
      <AskPlacingGhost host={host} />
      {dock.spots ? (
        <div className="ask-draft-spots" aria-hidden="true">
          {DOCK_SPOTS.map((id) => (
            <span key={id} data-spot={id} data-near={dock.hover === id ? "true" : undefined} />
          ))}
        </div>
      ) : null}
      {draft === "b" && ask.pending && (props.readingNodeIds?.length ?? 0) > 0 ? <AskReadingLines host={host} surfaceRef={dock.surfaceRef} nodeIds={props.readingNodeIds ?? []} onShowing={setLinesShowing} /> : null}
      <section
        ref={dock.surfaceRef as RefObject<HTMLElement>}
        aria-label="Ask Lasso"
        className={`ask-draft ask-draft-${draft}`}
        data-position={dock.dock}
        data-collapsed={collapsed ? "true" : undefined}
        data-locked={locked ? "true" : undefined}
        data-dragging={dock.carried ? "true" : undefined}
        data-thinking={ask.pending ? "true" : undefined}
        data-caught={dock.hover ? "true" : undefined}
        onPointerDown={(event) => { event.stopPropagation(); dock.bind.onPointerDown(event); }}
        onPointerMove={dock.bind.onPointerMove}
        onPointerUp={dock.bind.onPointerUp}
        onPointerCancel={dock.bind.onPointerCancel}
        onWheel={(event) => event.stopPropagation()}
      >
        {showEdges ? <div {...edgeProps("top")} /> : null}
        <div className="ask-draft-head">
          <div role="button" tabIndex={0} className="ask-draft-grip" aria-label="Move Ask Lasso" onKeyDown={onGripKey}>
            <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
              {[2, 8, 14].flatMap((cy) => [2, 8].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" fill="currentColor" />))}
            </svg>
          </div>
          {draft === "b" ? (
            <span className="ask-draft-mark" aria-hidden="true">
              <LassoLoopMark className="h-[24px] w-[24px]" />
            </span>
          ) : null}
          <span className="ask-draft-title">Ask Lasso</span>
          {collapsed ? null : (
            <button type="button" className="ask-draft-head-btn ask-draft-new" onClick={() => { ask.newSession(); props.onTab("messages"); }}>New ask</button>
          )}
          <button type="button" className="ask-draft-head-icon" aria-label="History" aria-pressed={props.tab === "history"} onClick={() => props.onTab(props.tab === "history" ? "messages" : "history")}>
            <History size={16} aria-hidden="true" />
          </button>
          {empty ? null : (
            <button
              type="button"
              className="ask-draft-head-icon"
              aria-label={folded ? "Expand Ask Lasso" : "Collapse Ask Lasso"}
              aria-expanded={!folded}
              onClick={() => { noteWorkboardAskView(props.orgId, folded ? "expanded" : "folded", draft); setFolded(!folded); }}
            >
              {folded ? <ChevronsUpDown size={16} aria-hidden="true" /> : <ChevronsDownUp size={16} aria-hidden="true" />}
            </button>
          )}
          <button type="button" className="ask-draft-head-icon" aria-label="Close Ask Lasso" onClick={props.onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div ref={bodyRef} className="ask-draft-body">
          {props.tab === "history" ? (
            <AskPastList
              ask={ask}
              pinned={props.pinnedAnswers ?? []}
              onOpen={(id) => { ask.openSession(id); props.onTab("messages"); }}
              onJump={(nodeId) => props.onJumpToAnswer?.(nodeId)}
            />
          ) : (
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
          )}
        </div>
        {folded ? null : (
          <button
            type="button"
            className="ask-draft-foot"
            aria-pressed={props.tab === "history"}
            onClick={() => {
              const next = props.tab === "history" ? "messages" : "history";
              if (next === "history") noteWorkboardAskView(props.orgId, "past_opened", draft);
              props.onTab(next);
            }}
          >
            {props.tab === "history" ? "Back to this chat" : "Past conversations"}
          </button>
        )}
        {showEdges && dock.dock === "free" ? <div {...edgeProps("bottom")} /> : null}
      </section>
    </>,
    host,
  );
}
