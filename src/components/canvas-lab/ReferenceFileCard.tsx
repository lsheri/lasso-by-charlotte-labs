import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { FileFormatIcon } from "@/components/work/FileFormatIcon";
import { supabase } from "@/integrations/supabase/client";
import { completeReferenceFileFn } from "@/lib/reference-file.functions";
import {
  REFERENCE_ADD_LABEL,
  REFERENCE_MADE_IN_CHAT,
} from "@/lib/reference-file-shared";
import { storageObjectKey } from "@/lib/upload-payload";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * P1b item 3. A file the chat produced whose bytes have not been added yet.
 * One drop zone; once the file lands the card renders as a normal card.
 */
export function ReferenceFileCard({ item }: { item: WorkItemRow }) {
  const complete = useServerFn(completeReferenceFileFn);
  const queryClient = useQueryClient();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = (item.source_meta ?? {}) as { filename?: string };
  const filename = meta.filename ?? item.title;

  async function add(file: File) {
    setBusy(true);
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setError("You're signed out.");
      setBusy(false);
      return;
    }
    const path = storageObjectKey(userId, crypto.randomUUID(), file.name);
    const upload = await supabase.storage.from("work-files").upload(path, file);
    if (upload.error) {
      setError(upload.error.message);
      setBusy(false);
      return;
    }
    const answer = await complete({
      data: { work_item_id: item.id, path, via: "drop", mime_type: file.type },
    }).catch(() => ({ status: "refused" as const, reason: "error" }));
    if (answer.status !== "done") setError("That file could not be added. Try again.");
    await queryClient.invalidateQueries({ queryKey: ["work-items"] });
    setBusy(false);
  }

  return (
    <div data-testid="reference-file-card" className="flex h-full flex-col gap-2 p-3 font-sans text-[13px] text-foreground">
      <div className="flex items-center gap-2">
        <FileFormatIcon item={item} size={20} />
        <span className="min-w-0 truncate font-medium">{filename}</span>
      </div>
      <span className="text-[11.5px] text-muted-foreground">{REFERENCE_MADE_IN_CHAT}</span>
      <label
        data-testid="reference-file-drop"
        data-over={over}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOver(false);
          const file = event.dataTransfer.files[0];
          if (file) void add(file);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        className={`mt-auto flex cursor-pointer items-center justify-center rounded-[6px] border border-dashed px-2 py-3 text-[11.5px] ${over ? "border-foreground bg-secondary" : "border-border"}`}
      >
        <input
          type="file"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void add(file);
          }}
        />
        {busy ? "Adding..." : REFERENCE_ADD_LABEL}
      </label>
      {error ? <span role="alert" className="text-[11.5px] text-muted-foreground">{error}</span> : null}
    </div>
  );
}

/** P1b item 3. The small line a completed placeholder carries. */
export function referenceMatchLine(item: WorkItemRow | undefined): string | null {
  const match = (item?.source_meta as { match?: string } | null | undefined)?.match;
  if (match === "yes") return "Verified against the chat";
  if (match === "no") return "Different from the version the chat produced";
  return null;
}
