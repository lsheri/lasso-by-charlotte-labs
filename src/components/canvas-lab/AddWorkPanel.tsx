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
import { useSettingsDialogOptional } from "@/lib/settings-dialog-context";

export type AddWorkSource = "inbox" | "upload" | "connector";

const SHARE_LINE = "Adding work here shares it with the people on this engagement.";

function isConnected(status: string | undefined): boolean {
  return Boolean(status) && status !== "not_connected" && status !== "disconnected";
}

export function AddWorkPanel({
  open,
  onOpenChange,
  onPlace,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hand the chosen or freshly captured ids to the board. */
  onPlace: (ids: string[], source: AddWorkSource) => Promise<void> | void;
  busy?: boolean;
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
      (item) => item.owner_id === profile?.id && item.visibility === "unmapped",
    );
  }, [work, profile?.id]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
      <DialogContent className="max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add work</DialogTitle>
          <DialogDescription>{SHARE_LINE}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="inbox">Inbox</TabsTrigger>
            <TabsTrigger value="upload">From your computer</TabsTrigger>
            <TabsTrigger value="connectors">Connected apps</TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="space-y-3">
            {inbox.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing waiting in your inbox right now.
              </p>
            ) : (
              <ScrollArea
                className="h-72 rounded-md border"
                viewportClassName="[&>div]:!w-full [&>div]:!min-w-0"
              >
                <ul className="divide-y">
                  {inbox.map((item) => (
                    <li key={item.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                        <Checkbox
                          checked={picked.has(item.id)}
                          onCheckedChange={() => toggle(item.id)}
                          aria-label={`Choose ${item.title ?? "this work"}`}
                        />
                        <span className="min-w-0 flex-1 truncate">{item.title ?? "Untitled"}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{item.type}</span>
                      </label>
                    </li>
                  ))}
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
