/**
 * S2: one Share button holding both ways to share this board.
 *
 * Section one gives someone in the workspace one of two things. Section two is
 * the expiring link, unchanged from S1. Section three is something we are
 * building, shown as not available rather than as a control that does nothing.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { BoardLinkSection } from "@/components/canvas-lab/ShareBoardDialog";
import { GraphiteIcon } from "@/components/notebook/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ACCESS_CHOICES,
  COMING_LINE,
  COMING_STATE,
  COMING_TITLE,
  accessLabel,
  type EngagementAccessChoice,
} from "@/lib/engagement-access-shared";
import {
  listEngagementPeopleFn,
  setEngagementPersonAccessFn,
} from "@/lib/engagement-access.functions";

export function ShareDialog({
  engagementId,
  profileId,
}: {
  engagementId: string;
  profileId: string | undefined;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="outline" aria-label="Share" data-toolbar-control="share">
              <GraphiteIcon name="share" animate={false} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Share</TooltipContent>
        </Tooltip>
      </DialogTrigger>
      <DialogContent className="max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle>Share this board</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto">
          <PeopleSection engagementId={engagementId} profileId={profileId} open={open} />

          <section className="flex flex-col gap-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">
              A link that expires
            </p>
            <BoardLinkSection engagementId={engagementId} profileId={profileId} open={open} />
          </section>

          <ComingSection />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PeopleSection({
  engagementId,
  profileId,
  open,
}: {
  engagementId: string;
  profileId: string | undefined;
  open: boolean;
}) {
  const queryClient = useQueryClient();
  const list = useServerFn(listEngagementPeopleFn);
  const setAccess = useServerFn(setEngagementPersonAccessFn);
  const [pick, setPick] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const key = ["engagement-people", engagementId, profileId ?? ""] as const;

  const people = useQuery({
    queryKey: key,
    queryFn: () =>
      list({
        data: { engagement_id: engagementId, ...(profileId ? { profile_id: profileId } : {}) },
      }),
    enabled: open && !!engagementId,
    staleTime: 5_000,
  });

  const change = useMutation({
    mutationFn: (input: { person_id: string; access: EngagementAccessChoice | "none" }) =>
      setAccess({
        data: {
          engagement_id: engagementId,
          person_id: input.person_id,
          access: input.access,
          ...(profileId ? { profile_id: profileId } : {}),
        },
      }),
    onSuccess: async (answer) => {
      setProblem(answer.status === "done" ? null : "That could not be changed.");
      if (answer.status === "done") setPick("");
      await queryClient.invalidateQueries({ queryKey: key });
    },
    onError: () => setProblem("That could not be changed."),
  });

  const rows = people.data?.people ?? [];
  const onBoard = rows.filter((person) => person.access !== null);
  const canPick = rows.filter((person) => person.access === null);

  return (
    <section className="flex flex-col gap-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">People</p>

      <div className="flex flex-col gap-2">
        <label className="nb-type-small text-muted" htmlFor="share-person">
          Choose someone from your workspace
        </label>
        <select
          id="share-person"
          aria-label="Choose someone from your workspace"
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={pick}
          onChange={(event) => setPick(event.target.value)}
        >
          <option value="">Nobody chosen</option>
          {canPick.map((person) => (
            <option key={person.id} value={person.id}>
              {person.display_name}
            </option>
          ))}
        </select>

        <div className="flex flex-col gap-2">
          {ACCESS_CHOICES.map((choice) => (
            <div key={choice.value} className="flex items-start justify-between gap-3">
              <p className="nb-type-small text-muted">{choice.line}</p>
              <Button
                size="sm"
                variant="outline"
                disabled={!pick || change.isPending}
                onClick={() => change.mutate({ person_id: pick, access: choice.value })}
              >
                {choice.label}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {problem ? <p className="nb-type-small text-foreground">{problem}</p> : null}

      <div className="flex flex-col gap-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">
          Already on this board
        </p>
        {onBoard.length === 0 ? (
          <p className="nb-type-small text-muted">Nobody else is on this board yet.</p>
        ) : (
          <ul className="space-y-2">
            {onBoard.map((person) => (
              <li
                key={person.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border p-2"
              >
                <span className="nb-type-small text-muted">
                  {person.display_name} · {accessLabel(person.access as EngagementAccessChoice)}
                </span>
                {person.isYou ? (
                  <span className="nb-type-small text-muted">You</span>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={change.isPending}
                    onClick={() => change.mutate({ person_id: person.id, access: "none" })}
                  >
                    Take it away
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Not a control. Nothing to press, and it never says this exists today. */
function ComingSection() {
  return (
    <section aria-disabled="true" className="flex flex-col gap-2 opacity-60">
      <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">{COMING_STATE}</p>
      <p className="nb-type-small text-foreground">{COMING_TITLE}</p>
      <p className="nb-type-small text-muted">{COMING_LINE}</p>
    </section>
  );
}
