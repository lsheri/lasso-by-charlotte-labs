/**
 * S2: one Share button holding both ways to share this board.
 *
 * Section one gives someone in the workspace one of two things. Section two is
 * the expiring link, unchanged from S1.
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
import {
  ACCESS_CHOICES,
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
        <Button size="icon" variant="outline" aria-label="Share" title="Share" data-toolbar-control="share">
          <GraphiteIcon name="share" animate={false} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle>Share this board</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto">
          <PeopleSection engagementId={engagementId} profileId={profileId} open={open} />

          <section className="flex flex-col gap-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-foreground">
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

      {people.data && canPick.length === 0 ? (
        <p className="nb-type-small text-foreground" data-testid="share-nobody-to-pick">
          Nobody else is in your workspace yet. Invite people from Settings, People.
        </p>
      ) : (
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
              <p className="nb-type-small text-foreground">{choice.line}</p>
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
      )}

      {problem ? <p className="nb-type-small text-foreground">{problem}</p> : null}

      <div className="flex flex-col gap-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-foreground">
          Already on this board
        </p>
        {onBoard.length === 0 ? (
          <p className="nb-type-small text-muted-foreground">Nobody else is on this board yet.</p>
        ) : (
          <ul className="space-y-2">
            {onBoard.map((person) => (
              <li
                key={person.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border p-2"
              >
                <span className="nb-type-small text-muted-foreground">
                  {person.display_name} · {accessLabel(person.access as EngagementAccessChoice)}
                </span>
                {person.isYou ? (
                  <span className="nb-type-small text-muted-foreground">You</span>
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
