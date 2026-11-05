import { useCallback, useEffect, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { History, X } from "lucide-react";

import { AskSurface } from "@/components/reflect/AskSurface";
import type { AskLasso } from "@/components/reflect/use-ask-lasso";
import type { AskTab } from "@/components/reflect/ask-dock-state";
import type { AskSectionChoice } from "@/components/canvas-lab/BoardAsk";
import { noteWorkboardAskMoved } from "@/components/canvas-lab/canvas-lab-telemetry";
import { AskPlacingGhost } from "@/components/canvas-lab/ask-draft/AskPlacing";
import { readAskPosition, writeAskPosition, type AskDraft } from "@/lib/ask-draft";
import { ASK_DOCK_CONFIG, useAskDock, type DockId } from "@/lib/ask-dock-engine";

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

const HEADER_H = 44;

/** ASK-B1: Ask Lasso floating over the board, carried by the dock engine. Preview-gated. */
export function AskDraftSurface(props: Props) {
  const { draft, host, ask } = props;
  const bodyRef = useRef<HTMLDivElement>(null);
  const initial = useRef(readAskPosition(draft, safeStore())).current;

  const contentHeight = useCallback(() => {
    const body = bodyRef.current;
    if (!body || body.children.length === 0) return 160;
    let total = HEADER_H;
    for (const child of Array.from(body.children) as HTMLElement[]) {
      const cs = getComputedStyle(child);
      if (cs.display === "none") continue;
      const inner = child.classList.contains("nb-binder")
        ? ((child.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0)
        : child.offsetHeight;
      total += inner + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
    }
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
    onLand: (to, free) => {
      writeAskPosition(draft, to === "free" ? { to, x: free.x, y: free.y } : { to }, safeStore());
      noteWorkboardAskMoved(props.orgId, to, draft);
    },
  });

  const collapsed = props.tab === "messages" && (ask.messages ?? []).length === 0;
  const { refresh } = dock;

  // Content changes size: re-measure the body and the binder's scroll content.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const ro = new ResizeObserver(() => refresh());
    ro.observe(body);
    const binderBody = body.querySelector(".nb-binder-body");
    if (binderBody) ro.observe(binderBody);
    return () => ro.disconnect();
  }, [refresh, ask.messages, props.tab]);

  useLayoutEffect(() => { refresh(); }, [refresh, collapsed]);

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
          {Object.entries(dock.spots).map(([id, box]) => (
            <span key={id} data-near={dock.hover === id ? "true" : undefined} style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
              <i /><i /><i /><i />
            </span>
          ))}
        </div>
      ) : null}
      <section
        ref={dock.surfaceRef as RefObject<HTMLElement>}
        aria-label="Ask Lasso"
        className={`ask-draft ask-draft-${draft}`}
        data-position={dock.dock}
        data-collapsed={collapsed ? "true" : undefined}
        data-locked={locked ? "true" : undefined}
        data-dragging={dock.carried ? "true" : undefined}
        onPointerDown={(event) => { event.stopPropagation(); dock.bind.onPointerDown(event); }}
        onPointerMove={dock.bind.onPointerMove}
        onPointerUp={dock.bind.onPointerUp}
        onPointerCancel={dock.bind.onPointerCancel}
        onWheel={(event) => event.stopPropagation()}
      >
        <div className="ask-draft-head">
          <div role="button" tabIndex={0} className="ask-draft-grip" aria-label="Move Ask Lasso" onKeyDown={onGripKey}>
            <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
              {[2, 8, 14].flatMap((cy) => [2, 8].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" fill="currentColor" />))}
            </svg>
          </div>
          <span className="ask-draft-title">Ask Lasso</span>
          {collapsed ? null : (
            <button type="button" className="ask-draft-head-btn ask-draft-new" onClick={() => { ask.newSession(); props.onTab("messages"); }}>New ask</button>
          )}
          <button type="button" className="ask-draft-head-icon" aria-label="History" aria-pressed={props.tab === "history"} onClick={() => props.onTab(props.tab === "history" ? "messages" : "history")}>
            <History size={16} aria-hidden="true" />
          </button>
          <button type="button" className="ask-draft-head-icon" aria-label="Close Ask Lasso" onClick={props.onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div ref={bodyRef} className="ask-draft-body">
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
