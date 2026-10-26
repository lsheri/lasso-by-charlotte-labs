import { displayName } from "@/lib/work-item-name";
import { DraftDecisionsButton } from "@/components/decisions/DraftDecisionsButton";
import { ThreadBody } from "@/components/peek/ThreadBody";
import type { ThreadFocus } from "@/components/peek/ThreadBody";
import { ChatUrlLink } from "@/components/work/ChatUrlLink";
import { ArtifactNote, SourceMark } from "@/components/work/SourceMark";
import { TypeChip } from "@/components/work/TypeIcon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { WorkItemRow } from "@/lib/work-types";

export const COPY = { back: "Back to the decisions" };

export function ThreadViewer({
  item,
  open,
  onOpenChange,
  focus,
  onBack,
  backLabel = COPY.back,
}: {
  item: WorkItemRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focus?: ThreadFocus | undefined;
  onBack?: (() => void) | undefined;
  backLabel?: string | undefined;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(85dvh-env(safe-area-inset-top))] overflow-y-auto sm:max-w-3xl" onEscapeKeyDown={onBack ? (event) => { event.preventDefault(); onBack(); } : undefined}>
        <DialogHeader>
          {onBack ? <Button variant="ghost" className="self-start" onClick={onBack}>{backLabel}</Button> : null}
          <DialogTitle className="page-title flex flex-wrap items-center gap-1.5">
            {item ? <SourceMark item={item} size={15} /> : null}
            <span className="min-w-0 break-words">{item ? displayName(item) || "Thread" : "Thread"}</span>
            {item ? <ArtifactNote item={item} /> : null}
          </DialogTitle>
          {item ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <TypeChip item={item} />
              <ChatUrlLink item={item} />
            </div>
          ) : null}
        </DialogHeader>

        {item ? <ThreadBody item={item} enabled={open} focus={focus} /> : null}

        {item && item.type === "ai_thread" ? (
          <div className="mt-6 flex justify-end border-t border-border pt-4">
            <DraftDecisionsButton workItemId={item.id} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
