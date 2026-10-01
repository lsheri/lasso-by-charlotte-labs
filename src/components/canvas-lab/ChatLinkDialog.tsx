import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { pastedChatUrl } from "@/lib/chat-url";
import { CHAT_LINK_INVALID } from "@/lib/work-chat-link";

export const CHAT_LINK_COPY = {
  add: "Add the chat link",
  change: "Change the chat link",
  title: "Link to the chat",
  description: "Paste the link to the chat this came from, so anyone reading the card can open it.",
  label: "Chat link",
  save: "Save link",
  remove: "Remove link",
  cancel: "Cancel",
  failed: "The link didn't save. Try again.",
} as const;

export function ChatLinkDialog({
  open,
  onOpenChange,
  current,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: string | null;
  onSave: (url: string | null) => Promise<void>;
}) {
  const [value, setValue] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setValue(current ?? ""); setError(null); }
  }, [open, current]);

  async function save(next: string | null) {
    if (next !== null && !pastedChatUrl(next)) { setError(CHAT_LINK_INVALID); return; }
    setBusy(true);
    try {
      await onSave(next);
      onOpenChange(false);
    } catch {
      setError(CHAT_LINK_COPY.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onPointerDown={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{CHAT_LINK_COPY.title}</DialogTitle>
          <DialogDescription>{CHAT_LINK_COPY.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => { event.preventDefault(); void save(value); }} className="space-y-2">
          <label className="nb-type-small text-muted-foreground" htmlFor="chat-link-input">{CHAT_LINK_COPY.label}</label>
          <Input id="chat-link-input" type="url" inputMode="url" autoComplete="off" placeholder="https://" value={value} maxLength={2048} onChange={(event) => { setValue(event.target.value); setError(null); }} aria-invalid={Boolean(error)} />
          {error ? <p role="alert" className="nb-type-small text-destructive">{error}</p> : null}
          <DialogFooter className="gap-2">
            {current ? <Button type="button" variant="ghost" disabled={busy} onClick={() => void save(null)}>{CHAT_LINK_COPY.remove}</Button> : null}
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{CHAT_LINK_COPY.cancel}</Button>
            <Button type="submit" disabled={busy}>{CHAT_LINK_COPY.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
