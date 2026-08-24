import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { ConnectorBrowseActions } from "@/components/connectors/ConnectorBrowseActions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PasteThreadDialog } from "@/components/work/PasteThreadDialog";
import { TranscriptsAction } from "@/components/work/TranscriptsAction";
import { UploadFilesButton } from "@/components/work/UploadFilesButton";
import { useWorkItems } from "@/hooks/use-work-items";
import { detachEpisodeItems, syncEpisodeForMapping } from "@/lib/episodes.functions";
import { defaultStream, rememberStream } from "@/lib/connect-to-work";
import { remapItems } from "@/lib/workflow-order";

export type ConnectStream = { id: string; name: string };

/**
 * Bring work into this engagement from the same places the Work page offers,
 * with one difference: the person says up front which workstream it lands in.
 * Nothing here invents a write. Items are created by the existing import paths
 * and then mapped through the shared order helpers, exactly as a canvas drop.
 */
export function ConnectToWorkSheet({
  engagementId,
  streams,
  profile,
  onChanged,
}: {
  engagementId: string;
  streams: ConnectStream[];
  profile: { id: string; org_id: string };
  onChanged: () => Promise<void> | void;
}) {
  const queryClient = useQueryClient();
  const syncEpisode = useServerFn(syncEpisodeForMapping);
  const detachEpisode = useServerFn(detachEpisodeItems);
  const { data } = useWorkItems();

  const [open, setOpen] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [landed, setLanded] = useState(0);
  // Everything that already existed when the sheet opened. Whatever shows up
  // after that is what this session imported.
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!open) {
      seen.current = null;
      setLanded(0);
      return;
    }
    setStreamId((current) => current ?? defaultStream(engagementId, streams.map((s) => s.id)));
    if (seen.current === null) {
      seen.current = new Set((data?.items ?? []).map((item) => item.id));
    }
  }, [open, engagementId, streams, data]);

  useEffect(() => {
    const known = seen.current;
    console.log("watcher", { open, known: known?.size, streamId, items: (data?.items ?? []).map((i) => ({ id: i.id, source: i.source, visibility: i.visibility })) });
    if (!open || !known || !streamId) return;
    const fresh = (data?.items ?? []).filter(
      (item) =>
        !known.has(item.id) &&
        item.visibility !== "mapped" &&
        // The sheet only offers Drive/Gmail/paste/upload/transcript actions.
        // An MCP push arriving while the sheet is open was not brought in here,
        // so mapping it would be non-consensual. Ignore those entirely.
        !item.source.startsWith("mcp:"),
    );
    if (fresh.length === 0) return;
    for (const item of fresh) known.add(item.id);
    void (async () => {
      const result = await remapItems({
        targets: fresh.map((item) => ({ id: item.id, type: item.type, source: item.source })),
        taskId: streamId,
        profile,
        detachEpisode: detachEpisode as never,
        syncEpisode: syncEpisode as never,
        invalidate: async (queryKey) => {
          await queryClient.invalidateQueries({ queryKey });
        },
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setLanded((n) => n + fresh.length);
      await queryClient.invalidateQueries({ queryKey: ["engagement-tasks", engagementId] });
      await onChanged();
    })();
    // profile and the server fns are stable for the life of the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, open, streamId]);

  const target = streams.find((s) => s.id === streamId) ?? null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" className="nb-hi">
          Connect to work
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetTitle className="page-title">Connect to work</SheetTitle>
        <SheetDescription className="text-sm text-muted-foreground">
          Anything you bring in here lands in the workstream you pick, which makes it visible to
          anyone this engagement is shared with.
        </SheetDescription>

        <div className="mt-5 space-y-2">
          <p className="micro-label">Where it lands</p>
          {streams.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add a workstream first, then bring work into it.
            </p>
          ) : (
            <select
              aria-label="Workstream"
              value={streamId ?? ""}
              onChange={(event) => {
                setStreamId(event.target.value);
                rememberStream(engagementId, event.target.value);
              }}
              className="w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm text-foreground"
            >
              {streams.map((stream) => (
                <option key={stream.id} value={stream.id}>
                  {stream.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {streams.length > 0 ? (
          <div className="mt-6 space-y-3">
            <p className="micro-label">Bring work in</p>
            <div className="flex flex-wrap gap-2">
              <ConnectorBrowseActions />
              <PasteThreadDialog
                trigger={
                  <Button type="button" variant="outline">
                    Paste a thread
                  </Button>
                }
              />
              <UploadFilesButton />
              <TranscriptsAction />
            </div>
          </div>
        ) : null}

        {landed > 0 && target ? (
          <p className="mt-5 text-sm text-foreground">
            {landed} item{landed === 1 ? "" : "s"} landed in {target.name}.
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </SheetContent>
    </Sheet>
  );
}
