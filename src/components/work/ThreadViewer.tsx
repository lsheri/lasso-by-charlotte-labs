import { DraftDecisionsButton } from "@/components/decisions/DraftDecisionsButton";
import { ThreadBody } from "@/components/peek/ThreadBody";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { WorkItemRow } from "@/lib/work-types";

export function ThreadViewer({
  item,
  open,
  onOpenChange,
}: {
  item: WorkItemRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="page-title">{item?.title ?? "Thread"}</DialogTitle>
        </DialogHeader>

        {item ? <ThreadBody item={item} enabled={open} /> : null}

        {item && item.type === "ai_thread" ? (
          <div className="mt-6 flex justify-end border-t border-border pt-4">
            <DraftDecisionsButton workItemId={item.id} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
