import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Maximize2 } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { FileFormatIcon } from "@/components/work/FileFormatIcon";
import { SourceMark, VendorMark } from "@/components/work/SourceMark";
import { forgetWorkboardFilePreview } from "@/hooks/use-workboard-file-previews";
import { supabase } from "@/integrations/supabase/client";
import { ConnectorPicker } from "@/components/connectors/ConnectorPicker";
import { useConnectorAccounts } from "@/hooks/use-connector-accounts";
import { completeReferenceFileFn, completeReferenceFromDriveFn } from "@/lib/reference-file.functions";
import {
  REFERENCE_ADD_LABEL,
  REFERENCE_DRIVE_LABEL,
  REFERENCE_MADE_IN_CHAT,
} from "@/lib/reference-file-shared";
import { storageObjectKey } from "@/lib/upload-payload";
import { effectiveWorkDate, formatDate, type WorkItemRow } from "@/lib/work-types";

/**
 * P1b item 3. A file the chat produced whose bytes have not been added yet.
 * One drop zone; once the file lands the card renders as a normal card.
 */
export function ReferenceFileCard({ item, onOpen }: { item: WorkItemRow; onOpen: () => void }) {
  const complete = useServerFn(completeReferenceFileFn);
  const completeFromDrive = useServerFn(completeReferenceFromDriveFn);
  const { data: accounts } = useConnectorAccounts();
  const driveConnected = accounts?.["googledrive"]?.status === "connected";
  const [driveOpen, setDriveOpen] = useState(false);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const meta = (item.source_meta ?? {}) as { filename?: string };
  const filename = meta.filename ?? item.title;

  async function refresh() {
    setAdded(true);
    forgetWorkboardFilePreview(item.id);
    // The board reads items from the engagement page payload, keyed ["engagement", id, profile].
    await queryClient.invalidateQueries({ queryKey: ["engagement"] });
    await queryClient.invalidateQueries({ queryKey: ["document-versions", item.id] });
    await queryClient.invalidateQueries({ queryKey: ["work-items"] });
  }

  async function add(file: File) {
    setBusy(true);
    setError(null);
    // A stale card whose file is already added: skip the upload, just refresh.
    if (item.content_fidelity !== "reference") {
      await refresh();
      setBusy(false);
      return;
    }
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
    // "not_reference" means an earlier add already completed this card.
    const alreadyDone = answer.status === "refused" && answer.reason === "not_reference";
    if (answer.status === "done" || alreadyDone) {
      await refresh();
    } else {
      setError("That file could not be added. Try again.");
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
    }
    setBusy(false);
  }

  /** C2: the person chose one Drive file; the server fetches and attaches it. */
  async function addFromDrive(file: { id: string; mimeType: string | null }) {
    setBusy(true);
    setError(null);
    const answer = await completeFromDrive({
      data: { work_item_id: item.id, drive_file_id: file.id, mime_type: file.mimeType ?? "" },
    }).catch(() => ({ status: "refused" as const, reason: "error" }));
    const alreadyDone = answer.status === "refused" && answer.reason === "not_reference";
    if (answer.status === "done" || alreadyDone) {
      await refresh();
    } else {
      setError("That file could not be added. Try again.");
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
    }
    setBusy(false);
  }

  return (
    <div
      data-testid="reference-file-card"
      data-drawing="preview"
      data-preview-shape="portrait"
      className="nb-paper canvas-lab-preview-frame h-full min-h-0"
      onPointerDown={(event) => {
        if ((event.target as Element).closest("[data-reference-drag-strip]")) return;
        event.stopPropagation();
      }}
    >
      <header data-reference-drag-strip className="canvas-lab-preview-source">
        <span><SourceMark item={item} size={12} /><VendorMark item={item} /> · {formatDate(effectiveWorkDate(item))}</span>
        <Button type="button" size="icon" variant="ghost" aria-label={`Open ${item.title} larger`} title="Open larger" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onOpen(); }}><Maximize2 aria-hidden="true" /></Button>
      </header>
      <div className="nb-preview-content flex min-h-0 flex-1 flex-col gap-2 p-3 font-sans text-sm text-foreground">
        <div className="flex items-center gap-2">
          <FileFormatIcon item={item} size={20} />
          <span className="min-w-0 truncate font-medium">{filename}</span>
        </div>
        <span className="text-xs text-muted-foreground">{REFERENCE_MADE_IN_CHAT}</span>
        <div
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
          className={`mt-auto flex items-center justify-center rounded-[6px] border border-dashed px-2 py-3 ${over ? "border-foreground bg-secondary" : "border-border"}`}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy || added}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              inputRef.current?.click();
            }}
          >
            {added ? "Added. Loading the file..." : busy ? "Adding..." : REFERENCE_ADD_LABEL}
          </Button>
          {driveConnected && !added ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setDriveOpen(true);
              }}
            >
              {REFERENCE_DRIVE_LABEL}
            </Button>
          ) : null}
        </div>
        {error ? <span role="alert" className="text-xs text-muted-foreground">{error}</span> : null}
      </div>
      {driveConnected ? (
        <ConnectorPicker
          kind="googledrive"
          open={driveOpen}
          onOpenChange={setDriveOpen}
          onPickFile={addFromDrive}
        />
      ) : null}
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void add(file);
        }}
      />
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
