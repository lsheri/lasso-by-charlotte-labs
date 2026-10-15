import { Link } from "@tanstack/react-router";
import { GraphiteIcon } from "@/components/notebook/icons";
import { boardHueIndex } from "@/lib/board-hue";
import { Input } from "@/components/ui/input";
import type { NavEngagement } from "@/lib/nav-groups";
import { TREE_COPY, useRecentBoards } from "@/lib/sidebar-tree-state";

export function BoardFinder({ profileId, boards, query, onQueryChange, onOpen }: {
  profileId: string | undefined;
  boards: NavEngagement[];
  query: string;
  onQueryChange: (query: string) => void;
  onOpen: () => void;
}) {
  const history = useRecentBoards(profileId);
  const recent = history.flatMap((id) => {
    const board = boards.find((board) => board.id === id && !board.archived_at);
    return board ? [board] : [];
  });
  return <>
    {boards.length >= 6 && recent.length > 0 ? <div data-testid="recent-boards">
      <div className="px-2 py-1 font-mono text-[13px] text-muted-foreground">{TREE_COPY.recent}</div>
      {recent.map((board) => <Link key={board.id} to="/engagements/$id" params={{ id: board.id }} search={{ work: undefined }}
        data-board-hue={boardHueIndex(board.id)}
        className="nb-nav-item min-h-[44px]" onClick={onOpen}>
        <GraphiteIcon name="workboard" size={20} />
        <span className="min-w-0 flex-1 truncate">{board.title}</span>
        {board.clients?.name ? <span className="max-w-[40%] truncate text-[13px] text-muted-foreground">{board.clients.name}</span> : null}
      </Link>)}
    </div> : null}
    {boards.length >= 10 ? <Input aria-label={TREE_COPY.find} placeholder={TREE_COPY.find} value={query}
      className="my-2 min-h-[44px] text-[13px]" onChange={(event) => onQueryChange(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onQueryChange(""); } }} /> : null}
  </>;
}