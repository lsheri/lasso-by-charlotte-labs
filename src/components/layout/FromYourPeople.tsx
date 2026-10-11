import { Link } from "@tanstack/react-router";

import { GraphiteIcon } from "@/components/notebook/icons";
import { groupBySharer, usePartnerSharedBoards } from "@/hooks/use-partner-shared-boards";

export const FROM_YOUR_PEOPLE_COPY = { heading: "From your people" } as const;

/**
 * MN-5: boards people shared with this partner workspace, grouped by person.
 * Titles only, never codes. Absent entirely when nothing is shared.
 */
export function FromYourPeopleGroup({
  onOpen,
  rowClassName = "nb-nav-item nb-nav-item-nested",
}: {
  onOpen: () => void;
  rowClassName?: string;
}) {
  const { data } = usePartnerSharedBoards();
  const groups = groupBySharer(Array.isArray(data) ? data : []);
  if (groups.length === 0) return null;
  return (
    <div data-nav-group="from_your_people">
      <div className="nb-group-header px-2">{FROM_YOUR_PEOPLE_COPY.heading}</div>
      <div className="mt-2 flex flex-col gap-0.5">
        {groups.map((group) => (
          <div key={group.sharedBy}>
            <div className="truncate px-2 py-1 font-mono text-[13px] text-muted-foreground">{group.sharedBy}</div>
            {group.boards.map((board) => (
              <Link
                key={board.link_id}
                to="/shared/$boardId"
                params={{ boardId: board.board_id }}
                onClick={onOpen}
                className={rowClassName}
                activeProps={{ className: "nb-nav-item-active" }}
              >
                <span className="nb-shared-ink inline-flex shrink-0" aria-hidden="true">
                  <GraphiteIcon name="members" size={16} animate={false} />
                </span>
                <span className="truncate">{board.title}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
