import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { ensureExtractsFn } from "@/lib/extract.functions";
import { logEvent } from "@/lib/telemetry";
import { logV2 } from "@/lib/telemetry-v2";
import { noteCaptureFn } from "@/lib/work-taxonomy.functions";
import { buildUploadSourceMeta, storageObjectKey } from "@/lib/upload-payload";
import { workTypeForFile } from "@/lib/work-types";

/**
 * One capture path for files, so the upload button and the drop zone on Find
 * it insert work the same way and emit the same existing capture events.
 */
export function useCaptureFiles() {
  const ensureExtracts = useServerFn(ensureExtractsFn);
  const noteCapture = useServerFn(noteCaptureFn);
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** F1: what did not come in, and why, so the reason is never swallowed. */
  async function captureWithResult(files: File[]): Promise<{ ids: string[]; failures: { name: string; reason: string }[] }> {
    const failures: { name: string; reason: string }[] = [];
    const ids = await run(files, failures);
    return { ids, failures };
  }

  async function capture(files: File[]): Promise<string[]> {
    return run(files, []);
  }

  async function run(files: File[], failures: { name: string; reason: string }[]): Promise<string[]> {
    if (files.length === 0 || !profile) return [];
    setPending(true);
    setError(null);
    setProgress({ done: 0, total: files.length });

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setError("You're signed out.");
      for (const file of files) failures.push({ name: file.name, reason: "You're signed out." });
      setPending(false);
      setProgress(null);
      return [];
    }

    const capturedIds: string[] = [];
    for (const [index, file] of files.entries()) {
      setProgress({ done: index, total: files.length });
      const path = storageObjectKey(userId, crypto.randomUUID(), file.name);
      const { error: uploadError } = await supabase.storage.from("work-files").upload(path, file);
      if (uploadError) {
        setError(uploadError.message);
        failures.push({ name: file.name, reason: uploadError.message });
        continue;
      }

      const type = workTypeForFile(file.name);
      const { data: created, error: insertError } = await supabase
        .from("work_items")
        .insert({
          owner_id: profile.id,
          org_id: profile.org_id,
          type,
          source: "upload",
          title: file.name,
          content_ref: path,
          ts_precision: "capture",
          // The reader guesses formats from the extension when it must, but a
          // file named "export" with no suffix is unreadable unless the
          // browser's own mime type is kept here at capture time.
          meta: { mime_type: file.type || null },
          source_meta: buildUploadSourceMeta(file),
        })
        .select("id")
        .maybeSingle();
      if (insertError) {
        setError(insertError.message);
        failures.push({ name: file.name, reason: insertError.message });
        continue;
      }

      if (created?.id) capturedIds.push(created.id);

      logEvent("workitem.captured", profile.org_id, {
        channel: "upload",
        type,
        source: "upload",
      });
      if (type === "document" || type === "deck" || type === "sheet") {
        logV2(
          "artifact.captured",
          { artifact_type: type, channel: "upload" },
          { profileId: profile.id, workItemId: created?.id },
        );
      }
    }

    if (capturedIds.length > 0) {
      void ensureExtracts({ data: { work_item_ids: capturedIds } }).catch(() => {});
      void noteCapture({ data: { work_item_ids: capturedIds, via: "upload" } }).catch(() => {});
    }

    await queryClient.invalidateQueries({ queryKey: ["work-items"] });
    setPending(false);
    setProgress(null);
    return capturedIds;
  }

  return { capture, captureWithResult, pending, progress, error, profile };
}
