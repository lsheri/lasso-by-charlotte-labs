import { displayName, nameMatches } from "@/lib/work-item-name";
import { queuedStillWanted } from "@/lib/ask-queue";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type { SaveForOneOnOneTarget } from "@/components/oneonone/SaveForOneOnOne";
import { useFirmChecks } from "@/hooks/use-firm-checks";
import { useProfile } from "@/hooks/use-profile";
import { useAnswerSources } from "@/hooks/use-answer-sources";
import { useEngagementPage } from "@/hooks/use-engagement-page";
import { useWorkItems } from "@/hooks/use-work-items";
import { supabase } from "@/integrations/supabase/client";
import { streamChatRequest } from "@/lib/stream-client";
import { awaitPrime, primeReadSet, shouldPrimeForDraft } from "@/lib/ask-prime-client";
import type { ReflectResult } from "@/lib/reflect-run.server";
import {
  boardSelectionScope,
  mappedItemsForEngagement,
  pointedAtIds,
  sessionRelatedToEngagement,
} from "@/lib/reflect-scope-shape";
import { logEvent } from "@/lib/telemetry";
import { parseScope, type ContextScope, type ScopeSource } from "@/lib/reflect-shared";
import type { ContextManifest } from "@/lib/context-manifest";
import { flagEnabled } from "@/lib/feature-flags";
import type { WorkItemRow } from "@/lib/work-types";

export type AskMessageRow = {
  id: number;
  role: string;
  content: string;
  context_manifest: unknown;
  created_at: string;
};

/** A live board selector. Null means the section no longer exists. */
export type SectionAskSource = { resolve: () => string[] | null; resolveImages?: () => string[] | null };

export const SECTION_ASK_COPY = {
  empty: "Nothing in this section yet",
  removed: "This section was removed. Choose work before asking.",
  outside: "Choose a work item in this section before asking.",
} as const;

export type AskLassoArgs = {
  open: boolean;
  engagementId: string;
  engagementTitle: string;
  profileId: string;
  orgId: string;
  sectionSource?: SectionAskSource | undefined;
};

/**
 * Everything Ask Lasso does, lifted out of the old dock so the desktop dock and
 * the mobile sheet run the identical machinery. Reads stay gated on `open`, the
 * live session still follows the selection, and nothing about context
 * selection, manifests or the streaming pipe changed in the move.
 */
export function useAskLasso({
  open,
  engagementId,
  engagementTitle,
  profileId,
  orgId,
  sectionSource,
}: AskLassoArgs) {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  // ASK-FIX: the question as sent, shown in the thread at once while Lasso works.
  const [asked, setAsked] = useState<string | null>(null);
  // ASK-FIX-3 (ask-v2): a question entered while an answer is still finishing, sent when it is done.
  const [queued, setQueued] = useState<string | null>(null);
  const [streamed, setStreamed] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [boardSelection, setBoardSelectionState] = useState<{ active: boolean; ids: string[]; images: string[]; videos?: number }>({ active: false, ids: [], images: [] });
  const [scopeSource, setScopeSource] = useState<ScopeSource>("all");
  const [sectionSelection, setSectionSelection] = useState<SectionAskSource | null>(sectionSource ?? null);
  useEffect(() => { setSectionSelection(sectionSource ?? null); }, [sectionSource]);
  const sectionIds = sectionSelection?.resolve();
  const sectionImageIds = sectionSelection?.resolveImages?.() ?? [];
  const sectionState = sectionSelection
    ? sectionIds === null ? SECTION_ASK_COPY.removed : sectionIds?.length === 0 && sectionImageIds.length === 0 ? SECTION_ASK_COPY.empty : null
    : null;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveTarget, setSaveTarget] = useState<SaveForOneOnOneTarget | null>(null);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [pointedNow, setPointedNow] = useState<WorkItemRow[]>([]);
  const [coverage, setCoverage] = useState<{
    truncated: boolean;
    fullCount: number;
    summaryCount: number;
    noTextCount?: number;
    share?: number | null;
  } | null>(null);
  const [liveManifest, setLiveManifest] = useState<ContextManifest | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const workQuery = useWorkItems();
  const { data: profile } = useProfile();
  const mapped: WorkItemRow[] = mappedItemsForEngagement(workQuery.data?.items ?? [], engagementId);
  // The firm's checks that apply here: org wide, this engagement, or this person.
  const { data: firmChecks } = useFirmChecks({
    orgId,
    engagementId,
    subjectProfileId: profileId,
  });

  // Everything mapped into this engagement is selected when the chat opens.
  // The person narrows from there; nothing is added behind their back.
  useEffect(() => {
    if (!open || selected !== null || mapped.length === 0) return;
    setSelected(new Set(mapped.map((i) => i.id)));
  }, [open, selected, mapped]);

  const selectedItems = sectionSelection
    ? (workQuery.data?.items ?? []).filter((item) => sectionIds?.includes(item.id))
    : mapped.filter((i) => (selected ? selected.has(i.id) : true));
  const mentionItems = sectionSelection ? selectedItems : mapped;

  // The brief can live on the engagement itself rather than as a marked item,
  // and that counts for the analyses that need one.
  const { data: engagementBrief } = useQuery({
    queryKey: ["engagement-brief-present", engagementId],
    enabled: open,
    queryFn: async (): Promise<boolean> => {
      const { data } = await supabase
        .from("engagements")
        .select("brief")
        .eq("id", engagementId)
        .maybeSingle();
      return Boolean((data?.brief ?? "").trim());
    },
  });

  // The workstreams of this engagement, read from the page payload that is
  // already in cache, so a chat scoped to a workstream is recognised as
  // belonging here without a second trip.
  const engagementPage = useEngagementPage(engagementId);
  const taskIds = (engagementPage.data?.tasks ?? []).map((task) => task.id);

  /**
   * The history list is only honest once the mapped work has landed. Until
   * then the surface shows the thinking dots rather than a wrong list.
   */
  const historySettled = !workQuery.isPending && !engagementPage.isPending;

  const mappedIds = mapped.map((i) => i.id);
  const { data: sessions } = useQuery({
    queryKey: ["dock-sessions", engagementId, profileId, mappedIds.length],
    enabled: open && historySettled,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_sessions")
        .select("id, title, created_at, context_scope")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []).filter((row) =>
        sessionBelongsHere(row.context_scope, {
          engagementId,
          mappedItemIds: mappedIds,
          taskIds,
        }),
      );
    },
  });

  /** A fresh chat keeps any live board pick; otherwise it reads the engagement. */
  function newSession() {
    setSessionId(null);
    setSelected(new Set(boardSelection.active ? boardSelection.ids : mapped.map((i) => i.id)));
    setCoverage(null);
    setError(null);
    setDraft("");
  }

  function openSession(id: string) {
    setSessionId(id);
    setCoverage(null);
  }

  // The @ menu reads the word being typed just before the caret.
  function onDraftChange(value: string, caret: number) {
    setDraft(value);
    // ASK-FIX-3: editing a held question drops the hold; the person sends it again when ready.
    if (queued !== null && value.trim() !== queued) setQueued(null);
    // PRIME-COST: warm the cache once typing starts, when the selection has settled.
    if (shouldPrimeForDraft(value)) primeNow();
    const upTo = value.slice(0, caret);
    const at = upTo.lastIndexOf("@");
    if (at === -1 || /\s/.test(upTo.slice(at + 1))) {
      setMention(null);
      return;
    }
    if (at > 0 && !/\s/.test(value[at - 1] ?? "")) {
      setMention(null);
      return;
    }
    setMention({ query: upTo.slice(at + 1), start: at });
    setMentionIndex(0);
  }

  const mentionMatches = mention
    ? mentionItems
        // ASK-FIX-4: the list finds a piece by the name on its card or by its original title.
        .filter((item) => nameMatches(item, mention.query))
        .slice(0, 6)
    : [];

  /** What the draft currently points at, so the narrowing is visible before send. */
  const pointedDraftIds = pointedAtIds(draft, mentionItems);
  const draftPointed = mentionItems.filter((item) => pointedDraftIds.includes(item.id));

  /** Insert the title as visible text. The tag itself narrows the read set. */
  function chooseMention(item: WorkItemRow) {
    if (!mention) return;
    const caret = composerRef.current?.selectionStart ?? draft.length;
    // ASK-FIX-4: insert the name the person sees on the card, not the stored title.
    const next = `${draft.slice(0, mention.start)}@${displayName(item)} ${draft.slice(caret)}`;
    setDraft(next);
    setMention(null);
    setScopeSource("pointed");
    composerRef.current?.focus();
  }

  function scopeForSelection(): ContextScope {
    // LOOK-2: "Only this board". An additive `board` key inside context_scope.
    const tag = (s: ContextScope) => engagementId ? { ...s, board: engagementId } : s;
    if (sectionSelection) {
      const images = sectionSelection.resolveImages?.() ?? [];
      return tag({ mode: "items", ids: sectionSelection.resolve() ?? [], ...(images.length ? { images } : {}) });
    }
    if (boardSelection.active) {
      return tag(boardSelectionScope({ engagementId, hasBoardPicks: true, mappedIds: boardSelection.ids, ...(boardSelection.images.length ? { imageIds: boardSelection.images } : {}) }));
    }
    if (!selected || selectedItems.length === 0 || selectedItems.length === mapped.length) {
      return tag({ mode: "engagements", ids: [engagementId] });
    }
    return tag({ mode: "items", ids: selectedItems.map((i) => i.id) });
  }
  const scopeKey = JSON.stringify(scopeForSelection()) + selectedItems.length;
  // TOTAL-5: warm the cache for the current read set so the first question is a
  // cache hit. PRIME-COST: called from onDraftChange once typing starts, no longer
  // on composer focus. No content, no event.
  const primeNow = () => {
    if (pending) return;
    void primeReadSet(scopeForSelection(), profileId);
  };

  // A live session follows the selection, so what Lasso reads and what the
  // audit strip records are always the current choice.
  useEffect(() => {
    if (!sessionId || (sectionSelection && pending)) return;
    void supabase
      .from("chat_sessions")
      .update({ context_scope: scopeForSelection() })
      .eq("id", sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, scopeKey, pending]);

  function applyBoardSelection(hasPicks: boolean, mappedIds: string[], imageIds: string[] = []) {
    const ids = [...mappedIds, ...imageIds];
    setSectionSelection(null);
    setBoardSelectionState((current) => ({ active: hasPicks, ids: mappedIds, images: imageIds, ...(current.videos ? { videos: current.videos } : {}) }));
    setScopeSource(hasPicks ? (ids.length > 0 ? "board_pick" : "board_pick_brief_only") : "all");
    setSelected(new Set(hasPicks ? mappedIds : mapped.map((item) => item.id)));
  }

  /** V2-2: videos are never context. The count only lets Ask say "not read". */
  function setBoardPickedVideos(count: number) {
    setBoardSelectionState((current) => (current.videos ?? 0) === count ? current : { ...current, videos: count });
  }

  function applyPickerSelection(next: Set<string> | null | ((previous: Set<string> | null) => Set<string> | null), source: ScopeSource = "picker") {
    setSectionSelection(null);
    setBoardSelectionState({ active: false, ids: [], images: [] });
    setScopeSource(source);
    setSelected((previous) => typeof next === "function" ? next(previous) : next);
  }

  async function writeCurrentScope(id: string, resolved?: ContextScope) {
    const { error: scopeError } = await supabase
      .from("chat_sessions")
      .update({ context_scope: resolved ?? scopeForSelection() })
      .eq("id", id);
    if (scopeError) throw new Error(scopeError.message);
  }

  const { data: messages } = useQuery({
    queryKey: ["reflect-messages", sessionId],
    enabled: Boolean(sessionId),
    queryFn: async (): Promise<AskMessageRow[]> => {
      const { data, error: e } = await supabase
        .from("chat_messages")
        .select("id, role, content, context_manifest, created_at")
        .eq("session_id", sessionId as string)
        .order("created_at", { ascending: true });
      if (e) throw e;
      return (data ?? []) as AskMessageRow[];
    },
  });

  const { data: sourcesByMessage } = useAnswerSources(
    (messages ?? []).filter((m) => m.role === "assistant").map((m) => Number(m.id)),
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, pending, asked]);

  // ASK-FIX-2: scroll again after the panel has grown to fit, and when the read set arrives,
  // so a follow-up's question and reading state come into view. The stream itself is not followed.
  useEffect(() => {
    if (!pending) return;
    let frame = 0;
    const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number;
    frame = raf(() => { frame = raf(() => {
      // V2-2c: when the reading state is shown (ask-v2), bring that whole block into view. Scrolling to the very end
      // overshoots by the spacer that holds the question near the top, which hid the status and chips.
      const reading = bottomRef.current?.parentElement?.querySelector<HTMLElement>('[data-testid="ask-reading-v2"]');
      if (reading) reading.scrollIntoView({ behavior: "smooth", block: "nearest" });
      else bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }); });
    return () => { if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame); };
  }, [pending, asked, liveManifest]);

  // V2-2d: the panel keeps growing for a moment after send (57 px to 165 px on the small board), after the
  // scroll above has run, so the reading state sat above view until the read set arrived. While a question is
  // in flight, bring the reading block back into view whenever the scroll area or the block changes size.
  // Dropped when the turn ends, so reading an answer is never pulled around.
  useEffect(() => {
    if (!pending || typeof ResizeObserver !== "function") return;
    const anchor = bottomRef.current;
    const scroller = anchor ? scrollAreaOf(anchor) : null;
    if (!anchor || !scroller) return;
    const refit = () => {
      const reading = anchor.parentElement?.querySelector<HTMLElement>('[data-testid="ask-reading-v2"]');
      if (reading && !fitsIn(reading, scroller)) reading.scrollIntoView({ behavior: "auto", block: "nearest" });
    };
    const watch = new ResizeObserver(refit);
    watch.observe(scroller);
    const reading = anchor.parentElement?.querySelector<HTMLElement>('[data-testid="ask-reading-v2"]');
    if (reading) watch.observe(reading);
    return () => watch.disconnect();
  }, [pending, asked, liveManifest]);

  async function ensureSession(): Promise<string | null> {
    if (sessionId) return sessionId;
    const scope: ContextScope = scopeForSelection();
    const { data, error: e } = await supabase
      .from("chat_sessions")
      .insert({
        profile_id: profileId,
        org_id: orgId,
        context_scope: scope,
        title: engagementTitle,
      })
      .select("id")
      .single();
    if (e) {
      setError(e.message);
      return null;
    }
    logEvent("reflect.session_created", orgId, {});
    setSessionId(data.id);
    await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
    return data.id;
  }

  async function submit() {
    return send(draft.trim());
  }

  /** ASK-FIX-3: hold the box's question until the answer in flight is done. */
  function queueSend() {
    const text = draft.trim();
    if (text) setQueued(text);
  }

  function cancelQueued() {
    setQueued(null);
  }

  // ASK-FIX-3: send the held question the moment the answer is done, if the box still says it.
  useEffect(() => {
    if (pending || queued === null) return;
    const text = queued;
    setQueued(null);
    if (queuedStillWanted(text, draft)) void send(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, queued]);

  /** AQ-1: send a saved question again. The server reuses its row. */
  async function resend(text: string) {
    return send(text.trim());
  }

  async function send(message: string) {
    if (!message || pending) return;
    // Resolve once at send, before any asynchronous work. Never enter a
    // board-pick or engagement fallback for an empty/deleted section.
    const resolvedIds = sectionSelection?.resolve();
    const resolvedImages = sectionSelection?.resolveImages?.() ?? [];
    if (sectionSelection && (resolvedIds === null || (!resolvedIds?.length && resolvedImages.length === 0))) {
      setError(resolvedIds === null ? SECTION_ASK_COPY.removed : SECTION_ASK_COPY.empty);
      return;
    }
    const resolvedScope: ContextScope | undefined = sectionSelection ? { mode: "items", ids: resolvedIds ?? [], ...(resolvedImages.length ? { images: resolvedImages } : {}) } : undefined;
    const available = sectionSelection ? (workQuery.data?.items ?? []).filter((item) => resolvedIds?.includes(item.id)) : mapped;
    const ids = pointedAtIds(message, available);
    if (sectionSelection && pointedAtIds(message, workQuery.data?.items ?? []).length > 0 && ids.length === 0) {
      setError(SECTION_ASK_COPY.outside);
      return;
    }
    const pointedItems = available.filter((item) => ids.includes(item.id));
    setPointedNow(pointedItems);
    setPending(true);
    setAsked(message);
    setDraft("");
    setError(null);
    setLiveManifest(null);
    try {
      const id = await ensureSession();
      if (!id) {
        setDraft((current) => current || message);
        return;
      }
      if (resolvedScope) await writeCurrentScope(id, resolvedScope);
      else await writeCurrentScope(id);
      // TOTAL-5b: never race a prime for the same read set; ride its cache.
      if (pointedItems.length === 0) await awaitPrime(resolvedScope ?? scopeForSelection());
      setStreamed("");
      const result = await streamChatRequest<ReflectResult>(
        "/api/reflect/stream",
        {
          session_id: id,
          message,
          profile_id: profileId,
          surface: "ask_lasso",
          pointed_at: pointedItems.map((i) => i.id),
          scope_source: pointedItems.length > 0 ? "pointed" : scopeSource,
          ...(sectionSelection ? { scope_kind: "section" } : {}),
        },
        (delta) => setStreamed((prev) => prev + delta),
        // V2-0: behind ask-v2, show what is being read as soon as the server knows it.
        flagEnabled("ask-v2") ? (manifest) => setLiveManifest(manifest as ContextManifest) : undefined,
      );
      setCoverage({
        truncated: result.truncated,
        fullCount: result.fullCount,
        summaryCount: result.summaryCount,
        noTextCount: result.noTextCount ?? 0,
        share: result.share ?? null,
      });
      setLiveManifest(result.manifest ?? null);
      await queryClient.invalidateQueries({ queryKey: ["reflect-messages", id] });
      await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
    } catch (e) {
      setError((e as Error).message);
      // Give the words back if the send failed and nothing new was typed.
      setDraft((current) => current || message);
    } finally {
      setPending(false);
      setAsked(null);
      setStreamed("");
      setPointedNow([]);
      if (sessionId) void queryClient.invalidateQueries({ queryKey: ["reflect-messages", sessionId] });
    }
  }

  return {
    asked,
    bottomRef,
    chooseMention,
    composerRef,
    coverage,
    draft,
    draftPointed,
    primeNow,
    engagementBrief,
    error: sectionState ?? error,
    firmChecks,
    historySettled,
    liveManifest,
    mapped,
    mention,
    mentionIndex,
    mentionMatches,
    messages,
    newSession,
    onDraftChange,
    openSession,
    pending,
    queued,
    queueSend,
    cancelQueued,
    pickerOpen,
    pointedNow,
    profile,
    saveTarget,
    selected,
    selectedItems,
    boardPickActive: boardSelection.active,
    boardPickedCount: boardSelection.ids.length + boardSelection.images.length,
    boardPickedVideos: boardSelection.videos ?? 0,
    sessionId,
    sessions,
    setMention,
    setMentionIndex,
    setPickerOpen,
    setSaveTarget,
    setSelected: applyPickerSelection,
    setBoardSelection: applyBoardSelection,
    setBoardPickedVideos,
    sourcesByMessage,
    streamed,
    submit,
    resend,
  };
}

export type AskLasso = ReturnType<typeof useAskLasso>;

/** LOOK-2: a session stamped with a board belongs only to that board; unstamped sessions keep today's rule. */
export function sessionBelongsHere(
  raw: unknown,
  where: { engagementId: string; mappedItemIds: Iterable<string>; taskIds: Iterable<string> },
): boolean {
  const board = (raw as { board?: string } | null)?.board;
  if (board) return board === where.engagementId;
  return sessionRelatedToEngagement(parseScope(raw), where);
}

/** V2-2d: the nearest ancestor that scrolls vertically. */
export function scrollAreaOf(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

/** V2-2d: true when the block sits wholly inside the scroll area (1 px slack for rounding). */
export function fitsIn(block: HTMLElement, area: HTMLElement): boolean {
  const b = block.getBoundingClientRect();
  const a = area.getBoundingClientRect();
  return b.top >= a.top - 1 && b.bottom <= a.bottom + 1;
}
