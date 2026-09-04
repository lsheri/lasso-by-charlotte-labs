import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Suggested, SuggestDot } from "@/components/common/Suggested";
import {
  confirmHandoffLink,
  curateSubject,
  listSubjects,
  populateSubjects,
} from "@/lib/subjects.functions";
import { matchableSubjects, type Subject } from "@/lib/subjects-shared";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * Pass 167. Two quiet things in one panel: the subjects your work mentions,
 * which you settle yourself, and the readings of where a piece of work went
 * next, which stay suggestions until you say which piece they point at.
 */
export function SubjectsPanel({
  profileId,
  items,
}: {
  profileId: string | undefined;
  items: WorkItemRow[];
}) {
  const queryClient = useQueryClient();
  const list = useServerFn(listSubjects);
  const populate = useServerFn(populateSubjects);
  const curate = useServerFn(curateSubject);
  const confirmLink = useServerFn(confirmHandoffLink);

  const [mergeFor, setMergeFor] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["subjects", profileId],
    queryFn: () => list({ data: { profile_id: profileId } }),
    enabled: Boolean(profileId),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["subjects", profileId] });

  const fill = useMutation({
    mutationFn: () => populate({ data: { profile_id: profileId } }),
    onSuccess: () => void refresh(),
  });

  const act = useMutation({
    mutationFn: (input: { entity_key: string; action: Subject["source"] | "merged" | "unmerged"; merge_into?: string }) =>
      curate({
        data: {
          profile_id: profileId,
          entity_key: input.entity_key,
          action: input.action as never,
          ...(input.merge_into ? { merge_into: input.merge_into } : {}),
        },
      }),
    onSuccess: () => {
      setMergeFor(null);
      void refresh();
    },
  });

  const join = useMutation({
    mutationFn: (input: { from_item_id: string; to_item_id: string }) =>
      confirmLink({ data: { profile_id: profileId, ...input } }),
    onSuccess: (result) => {
      setLinkFor(null);
      setNote(
        result.ok
          ? "Saved. That link is now part of the record."
          : result.reason === "no_turns"
            ? "One of those pieces has no messages stored, so there is nothing to point at yet."
            : "That piece is not yours to link.",
      );
    },
  });

  const subjects = data?.subjects ?? [];
  const suggestions = (data?.suggestions ?? []).filter((s) => !dismissed.includes(s.work_item_id));
  const targets = matchableSubjects(subjects);

  return (
    <div className="space-y-6 rounded-[var(--radius)] border border-border bg-card p-4">
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h3 className="page-title text-[15px]">Subjects in your work</h3>
          <button
            type="button"
            onClick={() => fill.mutate()}
            disabled={fill.isPending}
            className="ml-auto text-xs font-medium text-accent-deep underline-offset-4 transition-opacity hover:opacity-70 disabled:opacity-50"
          >
            {fill.isPending ? "Reading your work" : "Read subjects from your work"}
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading your subjects.</p>
        ) : subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing has been linked to this yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {subjects.map((subject) => (
              <li key={subject.entity_key} className="flex flex-wrap items-center gap-3 py-2">
                <span className="min-w-0 flex-1 break-words text-sm text-foreground">
                  {subject.entity_raw}
                  {subject.merged_into ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      folded into {subject.merged_into}
                    </span>
                  ) : null}
                  {subject.source === "confirmed" ? (
                    <span className="ml-2 text-xs text-muted-foreground">yours, confirmed</span>
                  ) : null}
                  {subject.source === "rejected" ? (
                    <span className="ml-2 text-xs text-muted-foreground">set aside</span>
                  ) : null}
                </span>

                {subject.merged_into ? (
                  <button
                    type="button"
                    onClick={() =>
                      act.mutate({ entity_key: subject.entity_key, action: "unmerged" })
                    }
                    className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
                  >
                    Undo fold
                  </button>
                ) : (
                  <>
                    {subject.source !== "confirmed" ? (
                      <button
                        type="button"
                        onClick={() =>
                          act.mutate({ entity_key: subject.entity_key, action: "confirmed" })
                        }
                        className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
                      >
                        This is right
                      </button>
                    ) : null}
                    {subject.source !== "rejected" ? (
                      <button
                        type="button"
                        onClick={() =>
                          act.mutate({ entity_key: subject.entity_key, action: "rejected" })
                        }
                        className="text-xs text-muted-foreground transition-opacity hover:opacity-70"
                      >
                        Set aside
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        setMergeFor(mergeFor === subject.entity_key ? null : subject.entity_key)
                      }
                      className="text-xs text-muted-foreground transition-opacity hover:opacity-70"
                    >
                      Fold into
                    </button>
                  </>
                )}

                {mergeFor === subject.entity_key ? (
                  <label className="w-full text-xs text-muted-foreground">
                    Fold {subject.entity_raw} into
                    <select
                      className="ml-2 rounded-[var(--radius-md)] border border-border bg-card px-2 py-1 text-xs text-foreground"
                      defaultValue=""
                      onChange={(event) => {
                        if (!event.target.value) return;
                        act.mutate({
                          entity_key: subject.entity_key,
                          action: "merged",
                          merge_into: event.target.value,
                        });
                      }}
                    >
                      <option value="">Choose a subject</option>
                      {targets
                        .filter((t) => t.entity_key !== subject.entity_key)
                        .map((t) => (
                          <option key={t.entity_key} value={t.entity_key}>
                            {t.entity_raw}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="page-title text-[15px]">Where the work went next</h3>
        {suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing has been linked to this yet.</p>
        ) : (
          suggestions.map((suggestion) => (
            <Suggested key={suggestion.work_item_id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SuggestDot />
                <p className="min-w-0 flex-1 break-words text-sm text-foreground">
                  <span className="font-medium">{suggestion.title}</span>: {suggestion.handoff}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                This is a reading of your work, not a fact. Say which piece it points at and it
                becomes part of the record.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setLinkFor(linkFor === suggestion.work_item_id ? null : suggestion.work_item_id)
                  }
                  className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
                >
                  It fed
                </button>
                <button
                  type="button"
                  onClick={() => setDismissed((prev) => [...prev, suggestion.work_item_id])}
                  className="text-xs text-muted-foreground transition-opacity hover:opacity-70"
                >
                  Not now
                </button>
              </div>
              {linkFor === suggestion.work_item_id ? (
                <label className="block text-xs text-muted-foreground">
                  It fed
                  <select
                    className="ml-2 rounded-[var(--radius-md)] border border-border bg-card px-2 py-1 text-xs text-foreground"
                    defaultValue=""
                    onChange={(event) => {
                      if (!event.target.value) return;
                      join.mutate({
                        from_item_id: suggestion.work_item_id,
                        to_item_id: event.target.value,
                      });
                    }}
                  >
                    <option value="">Choose a piece of your work</option>
                    {items
                      .filter((item) => item.id !== suggestion.work_item_id)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
            </Suggested>
          ))
        )}
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      </section>
    </div>
  );
}
