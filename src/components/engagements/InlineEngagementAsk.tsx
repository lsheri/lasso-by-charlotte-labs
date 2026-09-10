import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { AskSheet } from "@/components/reflect/AskSheet";
import { AskSurface } from "@/components/reflect/AskSurface";
import { useAskDockState } from "@/components/reflect/ask-dock-state";
import { useAskLasso } from "@/components/reflect/use-ask-lasso";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePerfOpenFinish } from "@/hooks/use-perf-timer";

const SUGGESTIONS = [
  "What did I decide here, and what did I decide it on?",
  "Where has this engagement drifted from the brief?",
];

function InlineAsk(props: {
  expanded: boolean;
  engagementId: string;
  engagementTitle: string;
  profileId: string;
  orgId: string;
  reveal: boolean;
  onConversationStart: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { expanded, engagementId, engagementTitle, profileId, orgId, reveal, onConversationStart, onOpenChange } = props;
  const { tab, setTab } = useAskDockState();
  const ask = useAskLasso({ open: true, engagementId, engagementTitle, profileId, orgId });
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (reveal) setVisible(true);
  }, [reveal]);

  useEffect(() => {
    if ((ask.messages?.length ?? 0) > 0) onConversationStart();
  }, [ask.messages?.length, onConversationStart]);

  const suggestions =
    expanded && (ask.messages?.length ?? 0) === 0 ? (
      <div className="flex flex-wrap gap-2 px-4 py-3">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => ask.onDraftChange(suggestion, suggestion.length)}
            className="h-auto min-h-9 whitespace-normal text-left text-xs"
          >
            {suggestion}
          </Button>
        ))}
      </div>
    ) : null;

  return (
    <section className={visible ? "relative flex min-h-[620px] flex-col overflow-hidden rounded-lg border border-graphite bg-card" : "hidden"}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Close Ask Lasso"
        onClick={() => {
          setVisible(false);
          onOpenChange(false);
        }}
        className="absolute right-2 top-2 z-10"
      >
        <X className="h-4 w-4" aria-hidden />
      </Button>
      <AskSurface
        ask={ask}
        tab={tab}
        onTab={setTab}
        engagementId={engagementId}
        engagementTitle={engagementTitle}
        profileId={profileId}
        orgId={orgId}
        onClose={() => {
          setVisible(false);
          onOpenChange(false);
        }}
        emptyActions={suggestions}
        inline
      />
    </section>
  );
}

export function EngagementAsk(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expanded: boolean;
  onConversationStart: () => void;
  engagementId: string;
  engagementTitle: string;
  profileId: string;
  orgId: string;
}) {
  const isMobile = useIsMobile();
  usePerfOpenFinish("ask_dock.open", props.open);

  return isMobile ? (
    <AskSheet {...props} />
  ) : (
    <InlineAsk {...props} reveal={props.open} />
  );
}