import { AskSheet } from "@/components/reflect/AskSheet";
import { useEffect } from "react";

import { AskBoardPickedContext, AskSurface } from "@/components/reflect/AskSurface";
import { AnswerKeepProvider, type KeptAnswer } from "@/components/reflect/answer-keep-context";
import { useAskDockState } from "@/components/reflect/ask-dock-state";
import { useAskLasso, type SectionAskSource } from "@/components/reflect/use-ask-lasso";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePerfOpenFinish } from "@/hooks/use-perf-timer";

/** A section offered in the Ask Lasso scope picker. Live from the board. */
export type AskSectionChoice = { id: string; title: string | null; marker: string | null };

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
  boardContextHasPicks: boolean;
  sectionSource?: SectionAskSource | undefined;
  /** SECD-3b: every section on the board, for the scope picker. */
  sectionChoices?: AskSectionChoice[] | undefined;
  onPickSection?: ((frameId: string) => void) | undefined;
};

/**
 * Ask Lasso beside the board. It sits in the board's own row rather than over
 * it, so the toolbar, the zoom controls and the canvas all keep their space
 * and the stage simply gets narrower.
 */
function BoardAskPanel(props: Props) {
  const { engagementId, engagementTitle, profileId, orgId } = props;
  const { width, tab, setTab } = useAskDockState();
  const ask = useAskLasso({ open: true, engagementId, engagementTitle, profileId, orgId, sectionSource: props.sectionSource });

  useEffect(() => {
    if (props.sectionSource) setTab("messages");
  }, [props.sectionSource, setTab]);

  // The board selection is the chat's context. Picked cards narrow what Lasso
  // reads; clearing the board selection puts the whole engagement back.
  const idsKey = props.boardContextItemIds.join("|");
  const mappedKey = ask.mapped.map((i) => i.id).join("|");
  const inMapped = props.boardContextItemIds.filter((id) => ask.mapped.some((i) => i.id === id));
  useEffect(() => {
    if (props.sectionSource) return;
    ask.setBoardSelection(props.boardContextHasPicks, inMapped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.boardContextHasPicks, idsKey, mappedKey, props.sectionSource]);

  return (
    <AskBoardPickedContext.Provider value={ask.boardPickActive}>
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
        headerTone="lime"
        inline
        sections={props.sectionChoices}
        onPickSection={props.onPickSection}
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
      headerTone="lime"
      sectionSource={props.sectionSource}
      sectionChoices={props.sectionChoices}
      onPickSection={props.onPickSection}
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
