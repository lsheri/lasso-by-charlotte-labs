import { AskSheet } from "@/components/reflect/AskSheet";
import { useEffect, useRef } from "react";

import { AskBoardPickedContext, AskSurface } from "@/components/reflect/AskSurface";
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
  onKeep: (answer: KeptAnswer, via?: "button" | "drag") => void;
  /** Work item ids of the cards picked "in context" on the board. */
  boardContextItemIds: string[];
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

  // The board selection is the chat's context. Picked cards narrow what Lasso
  // reads; clearing the board selection puts the whole engagement back.
  const idsKey = props.boardContextItemIds.join("|");
  const mappedKey = ask.mapped.map((i) => i.id).join("|");
  const hadPicks = useRef(false);
  const inMapped = props.boardContextItemIds.filter((id) => ask.mapped.some((i) => i.id === id));
  useEffect(() => {
    if (ask.mapped.length === 0) return;
    if (props.boardContextItemIds.length > 0) {
      hadPicks.current = true;
      ask.setSelected(new Set(props.boardContextItemIds.filter((id) => ask.mapped.some((i) => i.id === id))));
    } else if (hadPicks.current) {
      hadPicks.current = false;
      ask.setSelected(new Set(ask.mapped.map((i) => i.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, mappedKey]);

  return (
    <AskBoardPickedContext.Provider value={inMapped.length > 0}>
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
    </AskBoardPickedContext.Provider>
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
