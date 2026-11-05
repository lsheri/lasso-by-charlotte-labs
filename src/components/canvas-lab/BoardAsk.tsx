import { AskSheet } from "@/components/reflect/AskSheet";
import { useCallback, useEffect, useState } from "react";

import { AskDraftSurface } from "@/components/canvas-lab/ask-draft/AskDraftSurface";
import { armAskPlacing, cancelAskPlacing, isAskPlacingArmed } from "@/components/canvas-lab/ask-draft/AskPlacing";
import { ASK_DRAFT_OPEN_SESSION_EVENT, resolveAskDraft, type AskDraft } from "@/lib/ask-draft";

import { AskBoardPickedContext, AskSurface } from "@/components/reflect/AskSurface";
import { AnswerKeepProvider, useAnswerKeep, type KeptAnswer } from "@/components/reflect/answer-keep-context";
import { useAskDockState } from "@/components/reflect/ask-dock-state";
import { useAskLasso, type SectionAskSource } from "@/components/reflect/use-ask-lasso";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePerfOpenFinish } from "@/hooks/use-perf-timer";

/** A section offered in the Ask Lasso scope picker. Live from the board. */
export type AskSectionChoice = { id: string; title: string | null; marker: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagementId: string;
  engagementTitle: string;
  profileId: string;
  orgId: string;
  canKeep: boolean;
  /** ASK-D2 adds an optional board point and returns the saved node id; the closed path never passes a point. */
  onKeep: (answer: KeptAnswer, via?: "button" | "drag", at?: { x: number; y: number }) => void | Promise<string | null | void>;
  /** Work item ids of the cards picked "in context" on the board. */
  boardContextItemIds: string[];
  boardContextHasPicks: boolean;
  sectionSource?: SectionAskSource | undefined;
  /** SECD-3b: every section on the board, for the scope picker. */
  sectionChoices?: AskSectionChoice[] | undefined;
  onPickSection?: ((frameId: string) => void) | undefined;
  /** ASK-D1: the board's <main>, where a preview-gated draft floats. */
  floatHost?: HTMLElement | null | undefined;
};

/**
 * Ask Lasso beside the board. It sits in the board's own row rather than over
 * it, so the toolbar, the zoom controls and the canvas all keep their space
 * and the stage simply gets narrower.
 */
function BoardAskPanel(props: Props & { draft?: AskDraft | null; pendingSessionId?: string | null; onPendingDone?: () => void }) {
  const { engagementId, engagementTitle, profileId, orgId } = props;
  const { width, tab, setTab } = useAskDockState();
  const ask = useAskLasso({ open: true, engagementId, engagementTitle, profileId, orgId, sectionSource: props.sectionSource });

  useEffect(() => {
    if (props.sectionSource) setTab("messages");
  }, [props.sectionSource, setTab]);

  // The board selection is the chat's context. Picked cards narrow what Lasso
  // reads; clearing the board selection puts the whole engagement back.
  const idsKey = props.boardContextItemIds.join("|");
  const mappedKey = ask.mapped.map((i) => i.id).join("|");
  const inMapped = props.boardContextItemIds.filter((id) => ask.mapped.some((i) => i.id === id));
  useEffect(() => {
    if (props.sectionSource) return;
    ask.setBoardSelection(props.boardContextHasPicks, inMapped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.boardContextHasPicks, idsKey, mappedKey, props.sectionSource]);

  // ASK-D2: pinning, draft branch only. The outer keep exists only for people who may arrange the board.
  const outerKeep = useAnswerKeep();
  const { onKeep, boardContextHasPicks } = props;
  const draftKeep = useCallback((answer: KeptAnswer, via?: "button" | "drag") => {
    const withSession: KeptAnswer = { ...answer, sessionId: ask.sessionId ?? undefined };
    const after = (nodeId: string | null | void) => {
      if (!nodeId) return;
      ask.newSession();
      setTab("messages");
      requestAnimationFrame(() => ask.composerRef.current?.focus());
    };
    if (via === "drag") { void Promise.resolve(onKeep(withSession, "drag")).then(after); return; }
    if (boardContextHasPicks) { void Promise.resolve(onKeep({ ...withSession, pinVia: "auto" }, "button")).then(after); return; }
    if (isAskPlacingArmed()) { cancelAskPlacing(); return; }
    armAskPlacing({ onPlace: (at) => { void Promise.resolve(onKeep({ ...withSession, pinVia: "place" }, "button", at)).then(after); } });
  }, [ask, onKeep, boardContextHasPicks, setTab]);

  const { pendingSessionId, onPendingDone } = props;
  useEffect(() => {
    if (!pendingSessionId) return;
    ask.openSession(pendingSessionId);
    setTab("messages");
    onPendingDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSessionId]);

  if (props.draft && props.floatHost) {
    const surface = (
      <AskBoardPickedContext.Provider value={ask.boardPickActive}>
        <AskDraftSurface
          draft={props.draft}
          host={props.floatHost}
          ask={ask}
          tab={tab}
          onTab={setTab}
          engagementId={engagementId}
          engagementTitle={engagementTitle}
          profileId={profileId}
          orgId={orgId}
          onClose={() => props.onOpenChange(false)}
          sections={props.sectionChoices}
          onPickSection={props.onPickSection}
        />
      </AskBoardPickedContext.Provider>
    );
    return outerKeep ? <AnswerKeepProvider keep={draftKeep} label="Pin to board">{surface}</AnswerKeepProvider> : surface;
  }

  return (
    <AskBoardPickedContext.Provider value={ask.boardPickActive}>
    <aside
      aria-label="Ask Lasso"
      className="z-20 flex min-h-0 shrink-0 flex-col border-l border-border bg-background"
      style={{ width }}
    >
      <AskSurface
        ask={ask}
        tab={tab}
        onTab={setTab}
        engagementId={engagementId}
        engagementTitle={engagementTitle}
        profileId={profileId}
        orgId={orgId}
        onClose={() => props.onOpenChange(false)}
        headerTone="lime"
        inline
        sections={props.sectionChoices}
        onPickSection={props.onPickSection}
      />
    </aside>
    </AskBoardPickedContext.Provider>
  );
}

export function BoardAsk(props: Props) {
  const isMobile = useIsMobile();
  usePerfOpenFinish("ask_dock.open", props.open);
  const askDraft = useAskDraft();
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const { onOpenChange } = props;
  // ASK-D2 draft b: a pinned card asks for its chat; open Ask on that session.
  useEffect(() => {
    if (askDraft !== "b") return;
    const listen = (event: Event) => {
      const id = (event as CustomEvent<{ sessionId?: string }>).detail?.sessionId;
      if (!id) return;
      setPendingSessionId(id);
      onOpenChange(true);
    };
    window.addEventListener(ASK_DRAFT_OPEN_SESSION_EVENT, listen);
    return () => window.removeEventListener(ASK_DRAFT_OPEN_SESSION_EVENT, listen);
  }, [askDraft, onOpenChange]);

  const surface = isMobile ? (
    <AskSheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      engagementId={props.engagementId}
      engagementTitle={props.engagementTitle}
      profileId={props.profileId}
      orgId={props.orgId}
      headerTone="lime"
      sectionSource={props.sectionSource}
      sectionChoices={props.sectionChoices}
      onPickSection={props.onPickSection}
    />
  ) : props.open ? (
    <BoardAskPanel {...props} draft={askDraft} pendingSessionId={askDraft ? pendingSessionId : null} onPendingDone={() => setPendingSessionId(null)} />
  ) : null;

  if (!surface) return null;
  return props.canKeep ? (
    <AnswerKeepProvider keep={props.onKeep as (answer: KeptAnswer, via?: "button" | "drag") => void}>{surface}</AnswerKeepProvider>
  ) : (
    surface
  );
}

/** ASK-D1: read after hydration so SSR and the closed gate render as today. */
function useAskDraft(): AskDraft | null {
  const [draft, setDraft] = useState<AskDraft | null>(null);
  useEffect(() => {
    let store: Storage | null = null;
    try { store = window.localStorage; } catch { store = null; }
    setDraft(resolveAskDraft(window.location.host, window.location.search, store));
  }, []);
  return draft;
}
