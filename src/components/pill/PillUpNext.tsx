import { LEAD_VIEW_COPY, timeLeft, timeLeftLine, upNextOrder, type LedList } from "@/lib/lead-view-shared";

/**
 * 21 Nov 2026, chat pill PR 4b (D-97): the Lead's Up next, one line in the chat under the welcome: the proposal
 * closest to its goal and its clock, with one press to Home where the brief, documents and past work are. Nothing
 * for someone who leads no open proposal.
 */
export function PillUpNext({ data, now, onOpen }: { data: LedList | undefined; now?: Date | undefined; onOpen: () => void }) {
  if (!data || data.proposals.length === 0) return null;
  const [first] = upNextOrder(data.proposals, data.goalHours, now);
  if (!first) return null;
  const clock = timeLeftLine(timeLeft({ receivedAt: first.receivedAt, sentAt: first.sentAt, goalHours: data.goalHours, now }), data.goalHours);
  return (
    <div className="chat-pill__msg" data-pill-up-next={first.id}>
      <p>{LEAD_VIEW_COPY.pill(first.clientName || first.title, clock)}</p>
      <div className="chat-pill__acts">
        <button type="button" className="chat-pill__act" onClick={onOpen}>
          {LEAD_VIEW_COPY.pillOpen}
        </button>
      </div>
    </div>
  );
}
