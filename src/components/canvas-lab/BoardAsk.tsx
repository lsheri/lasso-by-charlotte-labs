import { AskSheet } from "@/components/reflect/AskSheet";
import { AskSurface } from "@/components/reflect/AskSurface";
import { AnswerKeepProvider, type KeptAnswer } from "@/components/reflect/answer-keep-context";
import { useAskDockState } from "@/components/reflect/ask-dock-state";
import { useAskLasso } from "@/components/reflect/use-ask-lasso";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePerfOpenFinish } from "@/hooks/use-perf-timer";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagementId: string;
  engagementTitle: string;
  profileId: string;
  orgId: string;
  canKeep: boolean;
  onKeep: (answer: KeptAnswer) => void;
};

/**
 * Ask Lasso beside the board. It sits in the board's own row rather than over
 * it, so the toolbar, the zoom controls and the canvas all keep their space
 * and the stage simply gets narrower.
 */
function BoardAskPanel(props: Props) {
  const { engagementId, engagementTitle, profileId, orgId } = props;
  const { width, tab, setTab } = useAskDockState();
  const ask = useAskLasso({ open: true, engagementId, engagementTitle, profileId, orgId });

  return (
    <aside
      aria-label="Ask Lasso"
      className="z-20 flex min-h-0 shrink-0 flex-col border-l border-border bg-background"
      style={{ width }}
    >
      <AskSurface
        ask={ask}
        tab={tab}
        onTab={setTab}
        engagementId={engagementId}
        engagementTitle={engagementTitle}
        profileId={profileId}
        orgId={orgId}
        onClose={() => props.onOpenChange(false)}
        inline
      />
    </aside>
  );
}

export function BoardAsk(props: Props) {
  const isMobile = useIsMobile();
  usePerfOpenFinish("ask_dock.open", props.open);

  const surface = isMobile ? (
    <AskSheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      engagementId={props.engagementId}
      engagementTitle={props.engagementTitle}
      profileId={props.profileId}
      orgId={props.orgId}
    />
  ) : props.open ? (
    <BoardAskPanel {...props} />
  ) : null;

  if (!surface) return null;
  return props.canKeep ? (
    <AnswerKeepProvider keep={props.onKeep}>{surface}</AnswerKeepProvider>
  ) : (
    surface
  );
}
