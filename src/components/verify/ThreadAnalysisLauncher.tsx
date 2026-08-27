/**
 * PASS 131 — a thread analysis launched from the peek goes straight to the
 * reader. The confirm step is unchanged, and nothing runs unconfirmed; what
 * goes away is the slide-over that used to flash in between. The run itself is
 * identical to the one the lens makes, session and telemetry included.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { AnalysisConfirm, type AnalysisConfirmRequest } from "@/components/reflect/AnalysisConfirm";
import {
  failVerifyThread,
  openVerifyThreadPending,
  resolveVerifyThread,
} from "@/components/verify/verify-thread-state";
import { analysisPreset } from "@/lib/analysis-presets";
import type { AnalysisRunResult } from "@/lib/analysis.functions";
import { streamChatRequest } from "@/lib/stream-client";
import { logEvent } from "@/lib/telemetry";

/** The two thread presets that own their own full screen reader. */
export type ThreadReaderPreset = "verification_thread" | "decision_origin_thread";

export function isThreadReaderPreset(preset: string): preset is ThreadReaderPreset {
  return preset === "verification_thread" || preset === "decision_origin_thread";
}

export function ThreadAnalysisLauncher({
  itemId,
  itemTitle,
  preset,
  profileId,
  orgId,
  onDone,
}: {
  itemId: string;
  itemTitle: string;
  preset: ThreadReaderPreset;
  profileId: string;
  orgId: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [request, setRequest] = useState<AnalysisConfirmRequest | null>(null);

  useEffect(() => {
    const found = analysisPreset(preset);
    if (!found) {
      onDone();
      return;
    }
    setRequest({
      preset: found,
      target: { kind: "item", id: itemId, title: itemTitle, scope: "thread" },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(anchorItemId: string | null) {
    const workItemId = anchorItemId ?? itemId;
    // The reader opens first: the person watches the transcript, never a wait.
    openVerifyThreadPending({
      itemId: workItemId,
      itemTitle,
      kind: preset === "decision_origin_thread" ? "decisions" : "verification",
    });
    try {
      const result = await streamChatRequest<AnalysisRunResult>("/api/analysis/stream", {
        preset_id: preset,
        confirm_step: "shown" as const,
        work_item_id: workItemId,
        profile_id: profileId,
      }, () => undefined);
      logEvent("reflect.session_created", orgId, { preset });
      await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
      if (result.run_id) resolveVerifyThread(result.run_id);
      else failVerifyThread("This analysis did not produce a run.");
    } catch (error) {
      failVerifyThread((error as Error).message);
    } finally {
      onDone();
    }
  }

  return (
    <AnalysisConfirm
      request={request}
      orgId={orgId}
      profileId={profileId}
      onCancel={() => {
        setRequest(null);
        onDone();
      }}
      onConfirm={(anchorItemId) => {
        setRequest(null);
        void run(anchorItemId);
      }}
    />
  );
}
