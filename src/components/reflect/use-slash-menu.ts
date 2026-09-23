import { useState } from "react";

import { useEngagementPage } from "@/hooks/use-engagement-page";
import { workstreamTasks } from "@/lib/board-default-task";
import { taskIdsOf } from "@/lib/reflect-scope-shape";
import type { WorkItemRow } from "@/lib/work-types";
import { filterWorkstreams, insertWorkstream, slashQuery, type SlashState } from "./slash-menu";

type AskForSlash = {
  engagementId: string | null | undefined;
  mapped: WorkItemRow[];
  draft: string;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
  onDraftChange: (value: string, caret: number) => void;
  setSelected: (next: Set<string>) => void;
};

/** B3: "/" names a workstream; choosing one narrows the chat to its work. */
export function useSlashMenu(ask: AskForSlash, onChosen?: () => void) {
  const page = useEngagementPage(ask.engagementId ?? "");
  const tasks = workstreamTasks(page.data?.tasks ?? []).map((task) => ({ id: task.id, name: task.name }));
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<{ name: string; ids: string[] } | null>(null);
  const matches = slash ? filterWorkstreams(tasks, slash.query) : [];

  function onChange(value: string, caret: number) {
    const next = slashQuery(value, caret);
    setSlash(next);
    if (next) setIndex(0);
  }

  function choose(task: { id: string; name: string }) {
    if (!slash) return;
    const caret = ask.composerRef.current?.selectionStart ?? ask.draft.length;
    const next = insertWorkstream(ask.draft, slash.start, caret, task.name);
    ask.onDraftChange(next, slash.start + task.name.length + 2);
    setSlash(null);
    const ids = ask.mapped.filter((item) => taskIdsOf(item).includes(task.id)).map((item) => item.id);
    if (ids.length > 0) {
      ask.setSelected(new Set(ids));
      setChosen({ name: task.name, ids });
    }
    onChosen?.();
    ask.composerRef.current?.focus();
  }

  return { open: Boolean(slash) && matches.length > 0, matches, index, setIndex, choose, close: () => setSlash(null), chosen, onChange };
}
