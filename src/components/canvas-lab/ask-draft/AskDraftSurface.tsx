import { useCallback, useEffect, useState, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, ChevronsDownUp, ChevronsUpDown, History, Pin, X } from "lucide-react";
import { BrandLogo } from "@/components/connectors/BrandLogo";

import { AskSurface } from "@/components/reflect/AskSurface";
import type { AskLasso } from "@/components/reflect/use-ask-lasso";
import type { AskTab } from "@/components/reflect/ask-dock-state";
import type { AskSectionChoice } from "@/components/canvas-lab/BoardAsk";
import { AskPastList, type PinnedAnswerRow } from "@/components/canvas-lab/ask-draft/AskPastList";
import { noteWorkboardAskMoved, noteWorkboardAskView } from "@/components/canvas-lab/canvas-lab-telemetry";
import { AskPlacingGhost } from "@/components/canvas-lab/ask-draft/AskPlacing";
import { AskReadingLines } from "@/components/canvas-lab/ask-draft/AskReadingLines";
import { AskLiveMark } from "@/components/canvas-lab/ask-draft/AskLiveMark";
import { ASK_LIFT_STYLES, AskReadingLoops, useAskLift } from "@/components/canvas-lab/ask-draft/AskReadingLoops";
import { beginTurn, turnKeyFor } from "@/lib/ask-reading-clock";
import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { readAskHome, readAskPosition, readUnpinned, writeAskPosition, type AskDraft } from "@/lib/ask-draft";
import { ASK_DOCK_CONFIG, DOCK_SPOTS, useAskDock, type DockId } from "@/lib/ask-dock-engine";
import { HANDOFF_VENDORS, handoffLine, handoffLineFits, handoffPrompt, handoffUrl, pickHandoffTool, readAskedTool, readHandoffDestination, shouldNudge, type H7Route } from "@/lib/ask-handoff";
import { ContinueInAI, H7_COPY, carryOut, useHandoffSignals } from "@/components/canvas-lab/ask-draft/ContinueInAI";
import { displayKind, kindNoun, usedItems, usedPhrase } from "@/lib/ask-reading-v2";
import { parseManifest } from "@/lib/context-manifest";
import { citationsFromManifest } from "@/lib/turn-labels";
import { Button } from "@/components/ui/button";
import { flagEnabled } from "@/lib/feature-flags";

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
  /** PIN-1: the board node this chat is pinned as, if any. */
  pinnedNodeId?: string | null | undefined;
  /** PIN-1: this chat was pinned once and taken off. */
  wasPinned?: boolean | undefined;
  onPinChat?: ((atScreen: { x: number; y: number } | null) => void) | undefined;
  onUnpinChat?: ((nodeId: string) => void) | undefined;
};

const FOOT_H = 34;

const HEADER_H = 46;

/** ASK-B1: Ask Lasso floating over the board, carried by the dock engine. Preview-gated. */
export function AskDraftSurface(props: Props) {
  const { draft, host, ask } = props;
  const bodyRef = useRef<HTMLDivElement>(null);
  const initial = useRef(readAskPosition(draft, safeStore())).current;
  const [folded, setFolded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const [, setLinesShowing] = useState(false);
  // ASK-FIX-2: a question in flight is not an empty chat, so the first turn shows its question and reading state.
  const empty = props.tab === "messages" && (ask.messages ?? []).length === 0 && !ask.pending;
  const collapsed = empty || folded;
  // V2-1 (A1, behind ask-v2): an unused Ask is one slim row until you click into it. Focus never primes the cache;
  // priming stays on typing (onDraftChange -> shouldPrimeForDraft -> primeNow).
  const askV2 = flagEnabled("ask-v2");
  const [focusedIn, setFocusedIn] = useState(false);
  const idleBar = askV2 && empty && !ask.pending && !focusedIn && !ask.error && !ask.pickerOpen;
  // V2-3 (ask-v2): the turn's clock starts on a real send only, so a redraw or remount resumes the light and loops.
  const turnKey = turnKeyFor(ask.asked);
  const sawPending = useRef(ask.pending);
  useEffect(() => {
    if (askV2 && ask.pending && !sawPending.current) beginTurn(turnKey, performance.now());
    sawPending.current = ask.pending;
  }, [askV2, ask.pending, turnKey]);
  useAskLift({ host: askV2 ? host : null, nodeIds: props.readingNodeIds ?? [], pending: ask.pending, error: Boolean(ask.error), turnKey });
  const dest = readHandoffDestination(props.engagementId, safeStore());
  const vendorLabel = HANDOFF_VENDORS.find((vendor) => vendor.id === dest.vendor)?.label ?? "Claude";
  const turns = (ask.messages ?? []).filter((m) => m.role === "assistant").length;
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [handoffHint, setHandoffHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nudgeHost, setNudgeHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setDismissedAt(null); }, [ask.sessionId]);
  useEffect(() => () => { if (hintTimer.current !== null) clearTimeout(hintTimer.current); }, []);
  useLayoutEffect(() => {
    const composer = bodyRef.current?.querySelector("div.sticky");
    if (!composer) return;
    const slot = document.createElement("div");
    composer.before(slot);
    setNudgeHost(slot);
    return () => { slot.remove(); };
  }, [props.tab]);
  const handoffOpen = async () => {
    const prompt = handoffPrompt({ boardTitle: props.engagementTitle, messages: ask.messages ?? [] });
    const opened = window.open(handoffUrl(dest), "_blank", "noopener");
    try { await navigator.clipboard.writeText(prompt); } catch { /* Carry on even when clipboard access is unavailable. */ }
    noteWorkboardAskView(props.orgId, "handoff_opened", draft);
    setHandoffHint(opened !== null ? "Prompt copied. Paste it there to carry on." : "Pop-up blocked. The prompt is on your clipboard.");
    if (hintTimer.current !== null) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHandoffHint(null), 2500);
  };
  // H7 (ask-v2): one Continue button, the AI worked out from pushes, packaged only on a click.
  const h7Signals = useHandoffSignals({ profileId: props.profileId, itemIds: (ask.mapped ?? []).map((item) => item.id), enabled: askV2 });
  const lastAnswer = [...(ask.messages ?? [])].reverse().find((m) => m.role === "assistant");
  const lastQuestion = [...(ask.messages ?? [])].reverse().find((m) => m.role === "user")?.content ?? "";
  const lastManifest = askV2 && lastAnswer ? parseManifest(lastAnswer.context_manifest) : null;
  const lastUsed = lastManifest && lastAnswer ? usedItems(lastManifest, citationsFromManifest(lastAnswer.context_manifest).map((c) => c.item_id)) : [];
  const h7Build = () => ({
    boardTitle: props.engagementTitle,
    messages: (ask.messages ?? []).map((m) => ({ role: m.role, content: m.content })),
    used: lastUsed.map((item) => ({ title: item.title, kind: kindNoun(displayKind(item), 1) })),
    board: (ask.mapped ?? []).map((item) => ({ title: item.display_title ?? item.title, kind: item.type === "ai_thread" ? "conversation" : item.type })),
  });
  const h7Done = (route: H7Route, blocked: boolean, label: string) => {
    noteWorkboardAskView(props.orgId, "handoff_opened", draft);
    setHandoffHint(blocked ? H7_COPY.hint.blocked : H7_COPY.hint[route](label));
    if (hintTimer.current !== null) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHandoffHint(null), 2500);
  };
  const h7Tool = askV2 ? pickHandoffTool({ ...(h7Signals ?? { boardPushes: [], myPushes: [], connected: [] }), asked: readAskedTool(props.profileId, safeStore()) }) : null;
  const h7LineShown = askV2 && Boolean(lastAnswer) && !ask.pending && handoffLineFits(lastQuestion) && h7Tool !== null;
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
    expanded: () => expandedRef.current,
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

  useLayoutEffect(() => { refresh(); }, [refresh, collapsed, folded, expanded, idleBar]);

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
  const pinned = Boolean(props.pinnedNodeId);
  const canPin = (ask.messages ?? []).some((m) => m.role === "assistant" && m.content.trim() !== "") && !ask.pending;
  const pinLabel = !pinned && !canPin ? "Ask something first, then pin the answer here" : pinned ? "Take off the board" : props.wasPinned ? "Pin this chat again" : "Pin this chat to the board";
  const onPinClick = () => {
    if (pinned) { props.onUnpinChat?.(props.pinnedNodeId as string); return; }
    const rect = dock.dock === "free" ? dock.surfaceRef.current?.getBoundingClientRect() : undefined;
    const point = rect ? { x: rect.left, y: rect.top } : null;
    props.onPinChat?.(point);
    if (point) { dock.moveTo(readAskHome(safeStore())); setFolded(true); }
  };

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
      {askV2 ? <style>{ASK_LIFT_STYLES}</style> : null}
      {draft === "b" && ask.pending && (props.readingNodeIds?.length ?? 0) > 0 ? (askV2
        ? <AskReadingLoops host={host} surfaceRef={dock.surfaceRef} nodeIds={props.readingNodeIds ?? []} turnKey={turnKey} onShowing={setLinesShowing} />
        : <AskReadingLines host={host} surfaceRef={dock.surfaceRef} nodeIds={props.readingNodeIds ?? []} onShowing={setLinesShowing} />) : null}
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
        data-idle-bar={idleBar ? "true" : undefined}
        onFocusCapture={(event) => { setFocusedIn(true); if (event.target instanceof HTMLTextAreaElement) setFolded(false); }}
        onBlurCapture={(event) => { const next = event.relatedTarget as Node | null; if (!next || !event.currentTarget.contains(next)) setFocusedIn(false); }}
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
              {askV2 ? <AskLiveMark pending={ask.pending} error={Boolean(ask.error)} turnKey={turnKey} /> : <LassoLoopMark className="h-[24px] w-[24px]" />}
            </span>
          ) : null}
          <span className="ask-draft-title">Ask Lasso</span>
          {draft === "b" && props.tab !== "history" ? (
            <button type="button" className="ask-draft-pin" data-idle={!pinned && !canPin ? "true" : undefined} data-on={pinned ? "true" : undefined} data-was={!pinned && props.wasPinned ? "true" : undefined} aria-pressed={pinned} aria-label={pinLabel} title={pinLabel} disabled={!pinned && !canPin} onClick={onPinClick}>
              <Pin size={18} aria-hidden="true" fill={pinned ? "currentColor" : "none"} />
            </button>
          ) : null}
          {collapsed ? null : (
            <button type="button" className="ask-draft-head-btn ask-draft-new" onClick={() => { ask.newSession(); props.onTab("messages"); dock.moveTo(readAskHome(safeStore())); setFolded(true); }}>New ask</button>
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
              onClick={() => { noteWorkboardAskView(props.orgId, folded ? "expanded" : "folded", draft); setExpanded(folded); setFolded(!folded); }}
            >
              {folded ? <ChevronsUpDown size={16} aria-hidden="true" /> : <ChevronsDownUp size={16} aria-hidden="true" />}
            </button>
          )}
          <button type="button" className="ask-draft-head-icon" aria-label="Close Ask Lasso" onClick={props.onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {handoffHint ? <p className="ask-draft-handoff-hint" role="status">{handoffHint}</p> : null}
        <div ref={bodyRef} className="ask-draft-body">
          {props.tab === "history" ? (
            <AskPastList
              ask={ask}
              pinned={props.pinnedAnswers ?? []}
              onOpen={(id) => { ask.openSession(id); props.onTab("messages"); }}
              onJump={(nodeId) => props.onJumpToAnswer?.(nodeId)}
              onUnpin={props.onUnpinChat}
              unpinned={readUnpinned(safeStore())}
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
            beforeComposer={ask.pending ? (
              <p className="px-4 py-2 text-xs text-muted-foreground" role="status" data-testid="ask-reading-scope">
                Reading {(ask.pointedNow?.length ? ask.pointedNow : ask.selectedItems ?? ask.mapped ?? []).length} {(ask.pointedNow?.length ? ask.pointedNow : ask.selectedItems ?? ask.mapped ?? []).length === 1 ? "item" : "items"} as written
              </p>
            ) : undefined}
            sendAside={draft === "b" && askV2 ? (
              <ContinueInAI profileId={props.profileId} disabled={!canPin} signals={h7Signals} build={h7Build} onDone={h7Done} />
            ) : draft === "b" ? (
              <button type="button" className="ask-draft-send-aside" aria-label={`Continue in ${vendorLabel}`} title={`Continue in ${vendorLabel}`} disabled={!canPin} onClick={handoffOpen}>
                <BrandLogo brand={dest.vendor === "chatgpt" ? "chatgpt" : "claude"} size={18} />
                <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            ) : undefined}
          />
          )}
        </div>
        {draft === "b" && askV2 && props.tab === "messages" && h7LineShown && h7Tool && nudgeHost ? createPortal(
          <div className="ask-draft-nudge" data-testid="h7-line">
            <Button type="button" variant="link" className="h-auto min-w-0 whitespace-normal p-0 text-left text-inherit" onClick={() => { void carryOut(h7Tool, { ...h7Build(), choice: "chat_and_used" }, Boolean(h7Signals?.signin) && h7Tool !== "gemini").then((r) => h7Done(r.route, r.blocked, h7Tool === "chatgpt" ? "ChatGPT" : h7Tool === "gemini" ? "Gemini" : "Claude")); }}>{handoffLine(h7Tool, usedPhrase(lastUsed))}</Button>
          </div>, nudgeHost,
        ) : null}
        {draft === "b" && !askV2 && props.tab === "messages" && shouldNudge(turns, dismissedAt) && !ask.pending && nudgeHost ? createPortal(
          <div className="ask-draft-nudge">
            <span>This is a long one. Keep what matters to the board, or carry it on in {vendorLabel} with the board as context.</span>
            <Button type="button" variant="link" className="h-auto p-0 text-inherit" onClick={handoffOpen}>Continue in {vendorLabel}</Button>
            <Button type="button" variant="link" className="h-auto p-0 text-inherit" onClick={() => setDismissedAt(turns)}>Not now</Button>
          </div>, nudgeHost,
        ) : null}
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
