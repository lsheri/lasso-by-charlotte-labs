import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { ensureExtractsFn } from "@/lib/extract.functions";
import { logEvent } from "@/lib/telemetry";
import { workTypeForFile } from "@/lib/work-types";

export function UploadFilesButton({ variant = "outline" }: { variant?: "default" | "outline" }) {
  const ensureExtracts = useServerFn(ensureExtractsFn);
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !profile) return;
    setPending(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setError("You're signed out.");
      setPending(false);
      return;
    }

    const capturedIds: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("work-files").upload(path, file);
      if (uploadError) {
        setError(uploadError.message);
        continue;
      }

      const type = workTypeForFile(file.name);
      const { data: created, error: insertError } = await supabase.from("work_items").insert({
        owner_id: profile.id,
        org_id: profile.org_id,
        type,
        source: "upload",
        title: file.name,
        content_ref: path,
        ts_precision: "capture",
      })
        .select("id")
        .maybeSingle();
      if (insertError) {
        setError(insertError.message);
        continue;
      }

      if (created?.id) capturedIds.push(created.id);

      logEvent("workitem.captured", profile.org_id, {
        channel: "upload",
        type,
        source: "upload",
      });
    }

    if (capturedIds.length > 0) {
      void ensureExtracts({ data: { work_item_ids: capturedIds } }).catch(() => {});
    }

    await queryClient.invalidateQueries({ queryKey: ["work-items"] });
    setPending(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant={variant}
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        {pending ? "Uploading…" : "Upload files"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
