import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useChatAnalyses } from "@/components/reflect/ChatAnalyses";
import type { SaveForOneOnOneTarget } from "@/components/oneonone/SaveForOneOnOne";
import { useFirmChecks } from "@/hooks/use-firm-checks";
import { useProfile } from "@/hooks/use-profile";
import { useAnswerSources } from "@/hooks/use-answer-sources";
import { useEngagementPage } from "@/hooks/use-engagement-page";
import { useWorkItems } from "@/hooks/use-work-items";
import { supabase } from "@/integrations/supabase/client";
import { streamChatRequest } from "@/lib/stream-client";
import type { ReflectResult } from "@/lib/reflect-run.server";
import {
  mappedItemsForEngagement,
  pointedAtIds,
  sessionRelatedToEngagement,
} from "@/lib/reflect-scope-shape";
import { logEvent } from "@/lib/telemetry";
import { parseScope, type ContextScope } from "@/lib/reflect-shared";
import type { ContextManifest } from "@/lib/context-manifest";
import type { WorkItemRow } from "@/lib/work-types";

export type AskMessageRow = {
  id: number;
  role: string;
  content: string;
  context_manifest: unknown;
};

export type AskLassoArgs = {
  open: boolean;
  engagementId: string;
  engagementTitle: string;
  profileId: string;
  orgId: string;
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
}: AskLassoArgs) {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [streamed, setStreamed] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveTarget, setSaveTarget] = useState<SaveForOneOnOneTarget | null>(null);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [pointedNow, setPointedNow] = useState<WorkItemRow[]>([]);
  const [coverage, setCoverage] = useState<{
    truncated: boolean;
    fullCount: number;
    summaryCount: number;
  } | null>(null);
  const [liveManifest, setLiveManifest] = useState<ContextManifest | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const workQuery = useWorkItems();
  const { data: profile } = useProfile();
  const mapped: WorkItemRow[] = mappedItemsForEngagement(workQuery.data?.items ?? [], engagementId);
  const analyses = useChatAnalyses(profileId, orgId);
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

  const selectedItems = mapped.filter((i) => (selected ? selected.has(i.id) : true));

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
        sessionRelatedToEngagement(parseScope(row.context_scope), {
          engagementId,
          mappedItemIds: mappedIds,
          taskIds,
        }),
      );
    },
  });

  /** A fresh chat: no session, no prior analyses, the whole engagement again. */
  function newSession() {
    setSessionId(null);
    setSelected(new Set(mapped.map((i) => i.id)));
    setCoverage(null);
    setError(null);
    setDraft("");
    analyses.clear();
  }

  function openSession(id: string) {
    setSessionId(id);
    setCoverage(null);
    analyses.clear();
  }

  // The @ menu reads the word being typed just before the caret.
  function onDraftChange(value: string, caret: number) {
    setDraft(value);
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
    ? mapped
        .filter((item) => item.title.toLowerCase().includes(mention.query.toLowerCase()))
        .slice(0, 6)
    : [];

  /** What the draft currently points at, so the narrowing is visible before send. */
  const pointedDraftIds = pointedAtIds(draft, mapped);
  const draftPointed = mapped.filter((item) => pointedDraftIds.includes(item.id));

  /** Insert the title as visible text. The tag itself narrows the read set. */
  function chooseMention(item: WorkItemRow) {
    if (!mention) return;
    const caret = composerRef.current?.selectionStart ?? draft.length;
    const next = `${draft.slice(0, mention.start)}@${item.title} ${draft.slice(caret)}`;
    setDraft(next);
    setMention(null);
    composerRef.current?.focus();
  }

  function scopeForSelection(): ContextScope {
    if (!selected || selectedItems.length === 0 || selectedItems.length === mapped.length) {
      return { mode: "engagements", ids: [engagementId] };
    }
    return { mode: "items", ids: selectedItems.map((i) => i.id) };
  }
  const scopeKey = scopeForSelection().ids.join(",") + selectedItems.length;

  // A live session follows the selection, so what Lasso reads and what the
  // audit strip records are always the current choice.
  useEffect(() => {
    if (!sessionId) return;
    void supabase
      .from("chat_sessions")
      .update({ context_scope: scopeForSelection() })
      .eq("id", sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, scopeKey]);

  const { data: messages } = useQuery({
    queryKey: ["reflect-messages", sessionId],
    enabled: Boolean(sessionId),
    queryFn: async (): Promise<AskMessageRow[]> => {
      const { data, error: e } = await supabase
        .from("chat_messages")
        .select("id, role, content, context_manifest")
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
  }, [messages?.length, pending]);

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
    const message = draft.trim();
    if (!message || pending) return;
    const ids = pointedAtIds(message, mapped);
    const pointedItems = mapped.filter((item) => ids.includes(item.id));
    setPointedNow(pointedItems);
    setPending(true);
    setError(null);
    setLiveManifest(null);
    try {
      const id = await ensureSession();
      if (!id) return;
      setStreamed("");
      setDraft("");
      const result = await streamChatRequest<ReflectResult>(
        "/api/reflect/stream",
        {
          session_id: id,
          message,
          profile_id: profileId,
          surface: "ask_lasso",
          pointed_at: pointedItems.map((i) => i.id),
        },
        (delta) => setStreamed((prev) => prev + delta),
      );
      setCoverage({
        truncated: result.truncated,
        fullCount: result.fullCount,
        summaryCount: result.summaryCount,
      });
      setLiveManifest(result.manifest ?? null);
      await queryClient.invalidateQueries({ queryKey: ["reflect-messages", id] });
      await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
      setStreamed("");
      setPointedNow([]);
    }
  }

  return {
    analyses,
    bottomRef,
    chooseMention,
    composerRef,
    coverage,
    draft,
    draftPointed,
    engagementBrief,
    error,
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
    pickerOpen,
    pointedNow,
    profile,
    saveTarget,
    selected,
    selectedItems,
    sessionId,
    sessions,
    setMention,
    setMentionIndex,
    setPickerOpen,
    setSaveTarget,
    setSelected,
    sourcesByMessage,
    streamed,
    submit,
  };
}

export type AskLasso = ReturnType<typeof useAskLasso>;
