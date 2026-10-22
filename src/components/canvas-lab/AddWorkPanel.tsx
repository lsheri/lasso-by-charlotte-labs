import { useMemo, useRef, useState } from "react";

import { ConnectorPicker } from "@/components/connectors/ConnectorPicker";
import { useCaptureFiles } from "@/components/work/use-capture-files";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConnectorAccounts } from "@/hooks/use-connector-accounts";
import { useProfile } from "@/hooks/use-profile";
import { useWorkItems } from "@/hooks/use-work-items";
import { orderWithBundles, toggleWithPieces } from "@/lib/add-work-selection";
import { useSettingsDialogOptional } from "@/lib/settings-dialog-context";
import { displayName } from "@/lib/work-item-name";
import type { MappedTask } from "@/lib/work-types";

export type AddWorkSource = "inbox" | "upload" | "connector";

const SHARE_LINE = "Adding work here shares it with the people on this workboard.";

function isConnected(status: string | undefined): boolean {
  return Boolean(status) && status !== "not_connected" && status !== "disconnected";
}

type BoardLinked = { work_item_tasks?: MappedTask[] | null };

/** BB-4: the board names this work already sits on, unique, from loaded data. */
export function boardNames(item: BoardLinked): string[] {
  const names = (item.work_item_tasks ?? []).map((link) => link.tasks?.engagements?.title).filter((name): name is string => Boolean(name));
  return [...new Set(names)];
}

export function isOnBoard(item: BoardLinked, engagementId: string | undefined): boolean {
  if (!engagementId) return false;
  return (item.work_item_tasks ?? []).some((link) => link.tasks?.engagement_id === engagementId || link.tasks?.engagements?.id === engagementId);
}

export function AddWorkPanel({
  open,
  onOpenChange,
  onPlace,
  busy,
  engagementId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hand the chosen or freshly captured ids to the board. */
  onPlace: (ids: string[], source: AddWorkSource) => Promise<void> | void;
  busy?: boolean;
  /** BB-4: the board being added to, so work already here is shown, not offered. */
  engagementId?: string | undefined;
}) {
  const { data: profile } = useProfile();
  const { data: work } = useWorkItems();
  const { data: accounts } = useConnectorAccounts();
  const settings = useSettingsDialogOptional();
  const { capture, pending: capturing, error: captureError } = useCaptureFiles();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("inbox");

  const inbox = useMemo(() => {
    const items = work?.items ?? [];
    return items.filter(
      (item) => item.owner_id === profile?.id && item.visibility !== "private",
    );
  }, [work, profile?.id]);

  // ATTACH-1: a chat's pieces dock under it instead of reading as strangers.
  const rows = useMemo(() => orderWithBundles(inbox), [inbox]);
  const piecesByChat = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of rows) {
      if (row.chatId) map.set(row.chatId, [...(map.get(row.chatId) ?? []), row.item.id]);
    }
    return map;
  }, [rows]);

  const toggle = (id: string) =>
    setPicked((prev) => toggleWithPieces(prev, id, piecesByChat.get(id) ?? []));

  async function addPicked() {
    const ids = [...picked];
    if (ids.length === 0) return;
    await onPlace(ids, "inbox");
    setPicked(new Set());
  }

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    const ids = await capture(files);
    if (ids.length > 0) await onPlace(ids, "upload");
  }

  const drive = isConnected(accounts?.["googledrive"]?.status);
  const gmail = isConnected(accounts?.["gmail"]?.status);
  const granola = isConnected(accounts?.["granola_mcp"]?.status);
  const anyConnector = drive || gmail || granola;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl grid-cols-[minmax(0,1fr)] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add work</DialogTitle>
          <DialogDescription>{SHARE_LINE}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="inbox">Your work</TabsTrigger>
            <TabsTrigger value="upload">From your computer</TabsTrigger>
            <TabsTrigger value="connectors">Connected apps</TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="space-y-3">
            {inbox.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing of yours to add yet.
              </p>
            ) : (
              <ScrollArea
                className="h-72 rounded-md border"
              >
                <ul className="divide-y">
                  {rows.map((row) => {
                    const item = row.item;
                    const boards = boardNames(item);
                    const here = Boolean(engagementId) && isOnBoard(item, engagementId);
                    const chat = row.chatId ? inbox.find((candidate) => candidate.id === row.chatId) : undefined;
                    return (
                      <li key={item.id}>
                        <label className={`${here ? "flex" : "flex cursor-pointer"} items-center gap-3 py-2 text-sm ${row.chatId ? "pl-9 pr-3" : "px-3"}`}>
                          {here ? (
                            <span className="w-4 shrink-0" aria-hidden />
                          ) : (
                            <Checkbox
                              checked={picked.has(item.id)}
                              onCheckedChange={() => toggle(item.id)}
                              aria-label={`Choose ${displayName(item) || "this work"}`}
                            />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{displayName(item) || "Untitled"}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {chat ? `Part of ${displayName(chat) || "its chat"}` : boards.length > 0 ? boards.join(", ") : "No board"}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{here ? "Already here" : item.type}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="upload" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pick files from this computer and they land on the board where you chose.
            </p>
            <input
              ref={fileInput}
              type="file"
              multiple
              className="sr-only"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                void addFiles(files);
              }}
            />
            <Button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={capturing || busy}
            >
              {capturing ? "Bringing it in" : "Choose files"}
            </Button>
            {captureError ? <p className="text-sm text-destructive">{captureError}</p> : null}
          </TabsContent>

          <TabsContent value="connectors" className="space-y-3">
            {anyConnector ? (
              <div className="flex flex-wrap gap-2">
                {drive ? (
                  <ConnectorPicker
                    kind="googledrive"
                    trigger={<Button type="button" variant="outline">Google Drive</Button>}
                    onImported={(ids) => void onPlace(ids, "connector")}
                  />
                ) : null}
                {gmail ? (
                  <ConnectorPicker
                    kind="gmail"
                    trigger={<Button type="button" variant="outline">Gmail</Button>}
                    onImported={(ids) => void onPlace(ids, "connector")}
                  />
                ) : null}
                {granola ? (
                  <ConnectorPicker
                    kind="granola"
                    trigger={<Button type="button" variant="outline">Granola</Button>}
                    onImported={(ids) => void onPlace(ids, "connector")}
                  />
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No apps are connected yet.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => settings?.openSettings("connectors", "deep_link")}
                >
                  Open your connected apps
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
        {activeTab === "inbox" ? (
          <DialogFooter>
            <Button type="button" onClick={addPicked} disabled={picked.size === 0 || busy}>
              Add to board
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
