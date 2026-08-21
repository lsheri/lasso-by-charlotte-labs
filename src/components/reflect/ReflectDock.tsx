import { AskDock } from "@/components/reflect/AskDock";
import { AskSheet } from "@/components/reflect/AskSheet";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Ask Lasso, docked beside an engagement. Same machinery as /reflect, the only
 * difference is the context scope, preset to this engagement. Chat content
 * never leaves this panel: only reflect.session_created / message_sent are
 * recorded, both content-free.
 *
 * This is now a thin adapter: the right hand dock on a desktop, a full screen
 * sheet on a phone, both running the one Ask Lasso hook.
 */
export function ReflectDock(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagementId: string;
  engagementTitle: string;
  profileId: string;
  orgId: string;
  /** Mapped pieces of work, counted once by the page and threaded down. */
  itemCount: number;
}) {
  const isMobile = useIsMobile();
  return isMobile ? <AskSheet {...props} /> : <AskDock {...props} />;
}
