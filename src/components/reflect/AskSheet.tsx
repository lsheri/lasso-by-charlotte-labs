import { AskSurface } from "@/components/reflect/AskSurface";
import { useAskDockState } from "@/components/reflect/ask-dock-state";
import { useAskLasso } from "@/components/reflect/use-ask-lasso";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

/**
 * On a phone the Ask tab fills the screen: same tabs, same binder paper, the
 * composer pinned above the keyboard and the scope chip a full width row.
 *
 * TODO (pass 87): CoachAskSheet — Messages only, wired to the existing
 * CoachChat machinery and locked to the coach's packet scope.
 */
export function AskSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagementId: string;
  engagementTitle: string;
  profileId: string;
  orgId: string;
}) {
  const { open, onOpenChange, engagementId, engagementTitle, profileId, orgId } = props;
  const { tab, setTab } = useAskDockState();
  const ask = useAskLasso({ open, engagementId, engagementTitle, profileId, orgId });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[100dvh] max-h-[100dvh] w-full flex-col gap-0 rounded-none border-0 bg-background p-0"
      >
        <SheetTitle className="sr-only">Ask Lasso</SheetTitle>
        <SheetDescription className="sr-only">Reflect on this engagement</SheetDescription>
        <AskSurface
          ask={ask}
          tab={tab}
          onTab={setTab}
          engagementId={engagementId}
          engagementTitle={engagementTitle}
          profileId={profileId}
          orgId={orgId}
          onClose={() => onOpenChange(false)}
          mobile
        />
      </SheetContent>
    </Sheet>
  );
}
