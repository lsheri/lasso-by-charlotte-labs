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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  type ConversationAccess,
  type EngagementAccessChoice,
} from "@/lib/engagement-access-shared";
import {
  listEngagementPeopleFn,
  setEngagementPersonAccessFn,
  setPersonConversationsFn,
} from "@/lib/engagement-access.functions";
import {
  getBoardConversationAccess,
  listMyPartnerShares,
  setBoardConversationAccess,
  listSharedEngagements,
  partnerShareLabel,
  shareEngagement,
  unshareEngagement,
  type PartnerShare,
} from "@/lib/partner-share";

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
          <GraphiteIcon name="share" size={20} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle>Share this board</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto">
          <PeopleSection engagementId={engagementId} profileId={profileId} open={open} />

          <SponsorSection engagementId={engagementId} profileId={profileId} open={open} />

          <section className="flex flex-col gap-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-foreground">
              A link that expires
            </p>
            <BoardLinkSection engagementId={engagementId} profileId={profileId} open={open} />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * SHARE-1a — the institution that sponsors this workspace, one row each, with
 * an on or off control for this board only. No sponsor, no section: most
 * people have none and must see no new chrome.
 */
function SponsorSection({
  engagementId,
  profileId,
  open,
}: {
  engagementId: string;
  profileId: string | undefined;
  open: boolean;
}) {
  const shares = useQuery({
    queryKey: ["partner-shares", profileId ?? ""],
    queryFn: () => listMyPartnerShares(profileId as string),
    enabled: open && Boolean(profileId),
    staleTime: 5_000,
  });

  const list = shares.data ?? [];
  if (list.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-foreground">
        Your sponsor
      </p>

      <ul className="space-y-2">
        {list.map((share) => (
          <SponsorRow
            key={share.linkId}
            share={share}
            engagementId={engagementId}
            open={open}
          />
        ))}
      </ul>

      <p className="nb-type-small text-muted-foreground">
        They see the work you have placed on this board, and nothing you have not placed.
      </p>
    </section>
  );
}

function SponsorRow({
  share,
  engagementId,
  open,
}: {
  share: PartnerShare;
  engagementId: string;
  open: boolean;
}) {
  const queryClient = useQueryClient();
  const key = ["partner-share-engagements", share.linkId] as const;
  const [problem, setProblem] = useState<string | null>(null);

  const shared = useQuery({
    queryKey: key,
    queryFn: () => listSharedEngagements(share.linkId),
    enabled: open,
    staleTime: 5_000,
  });

  const on = (shared.data ?? []).includes(engagementId);
  const convoKey = ["partner-share-conversations", share.linkId, engagementId] as const;
  const conversations = useQuery({
    queryKey: convoKey,
    queryFn: () => getBoardConversationAccess(share.linkId, engagementId),
    enabled: open && on,
    staleTime: 5_000,
  });
  const changeConversations = useMutation({
    mutationFn: (next: ConversationAccess) => setBoardConversationAccess(share.linkId, engagementId, next),
    onMutate: () => setProblem(null),
    onError: () => setProblem("That did not change. Try again."),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: convoKey });
    },
  });

  const toggle = useMutation({
    mutationFn: () =>
      on
        ? unshareEngagement(share.linkId, engagementId)
        : shareEngagement(share.linkId, engagementId),
    onMutate: () => setProblem(null),
    onError: () => setProblem("That did not change. Try again."),
    onSuccess: async () => {
      setProblem(null);
      await queryClient.invalidateQueries({ queryKey: key });
      await queryClient.invalidateQueries({ queryKey: ["affiliation-shared-boards"] });
    },
  });

  return (
    <li className="flex flex-col gap-1 rounded-md border border-border p-2">
      <div className="flex items-center justify-between gap-3">
        <span className="nb-type-small text-muted-foreground">{partnerShareLabel(share)}</span>
        <Button
          size="sm"
          variant={on ? "default" : "outline"}
          aria-pressed={on}
          disabled={toggle.isPending || shared.isPending}
          onClick={() => toggle.mutate()}
        >
          {on ? "Shared" : "Share"}
        </Button>
      </div>
      {on ? (
        <ConversationSwitch
          name={partnerShareLabel(share)}
          value={conversations.data ?? null}
          disabled={changeConversations.isPending || conversations.isPending}
          onChoose={(next) => changeConversations.mutate(next)}
        />
      ) : null}
      {problem ? <p className="nb-type-small text-foreground" role="alert">{problem}</p> : null}
      {share.bound ? null : (
        <p className="nb-type-small text-muted-foreground">Nobody there has opened this yet.</p>
      )}
    </li>
  );
}

export const PEOPLE_COPY = {
  heading: "Who has access",
  you: "You",
  add: "Add people by name",
  view: "Can view",
  multiplayer: "Multiplayer",
  viewLine: "Can open the board and read the cards.",
  multiplayerLine: "Can also add and arrange work.",
  remove: "Remove",
  membersOnly: "Only people in this workspace can be added here.",
  empty: "Nobody else is on this board yet.",
  nobodyToAdd: "Nobody else is in your workspace yet. Invite people from Settings, People.",
  problem: "That could not be changed.",
  summaries: "Summaries only",
  full: "Full conversations",
  summariesLine: "Summaries only: they can ask Lasso how AI was used here, but can't open the conversations.",
} as const;

const CONVERSATION_CHOICES = [
  { value: "summaries", label: PEOPLE_COPY.summaries },
  { value: "full", label: PEOPLE_COPY.full },
] as const;

function ConversationSwitch({
  name,
  value,
  disabled,
  onChoose,
}: {
  name: string;
  value: ConversationAccess | null;
  disabled: boolean;
  onChoose: (next: ConversationAccess) => void;
}) {
  return (
    <div role="group" aria-label={`${name} conversations`} className="flex gap-1">
      {CONVERSATION_CHOICES.map((choice) => (
        <Button
          key={choice.value}
          size="sm"
          variant={value === choice.value ? "secondary" : "outline"}
          aria-pressed={value === choice.value}
          disabled={disabled}
          onClick={() => onChoose(choice.value)}
        >
          {choice.label}
        </Button>
      ))}
    </div>
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
      setProblem(answer.status === "done" ? null : PEOPLE_COPY.problem);
      if (answer.status === "done") setPick("");
      await queryClient.invalidateQueries({ queryKey: key });
    },
    onError: () => setProblem(PEOPLE_COPY.problem),
  });

  const setConversations = useServerFn(setPersonConversationsFn);
  const changeConversations = useMutation({
    mutationFn: (input: { person_id: string; conversations: ConversationAccess }) =>
      setConversations({
        data: {
          engagement_id: engagementId,
          person_id: input.person_id,
          conversations: input.conversations,
          ...(profileId ? { profile_id: profileId } : {}),
        },
      }),
    onSuccess: async (answer) => {
      setProblem(answer.status === "done" ? null : PEOPLE_COPY.problem);
      await queryClient.invalidateQueries({ queryKey: key });
    },
    onError: () => setProblem(PEOPLE_COPY.problem),
  });

  const rows = people.data?.people ?? [];
  const you = rows.find((person) => person.isYou);
  const onBoard = rows.filter((person) => !person.isYou && person.access !== null);
  const canPick = rows.filter((person) => !person.isYou && person.access === null);
  const suggestions = canPick.filter((person) =>
    person.display_name.toLocaleLowerCase().includes(pick.trim().toLocaleLowerCase()),
  );
  const choices = [
    { value: "review", label: PEOPLE_COPY.view, line: PEOPLE_COPY.viewLine },
    { value: "work", label: PEOPLE_COPY.multiplayer, line: PEOPLE_COPY.multiplayerLine },
  ] as const;

  return (
    <section className="flex flex-col gap-3" aria-label={PEOPLE_COPY.heading}>
      <div className="flex flex-col gap-2">
        <label className="nb-type-small text-muted-foreground" htmlFor="share-person">
          {PEOPLE_COPY.add}
        </label>
        <Input
          id="share-person"
          value={pick}
          autoComplete="off"
          disabled={people.isPending || change.isPending || !people.data?.canShare || canPick.length === 0}
          onChange={(event) => setPick(event.target.value)}
        />
        {people.data && canPick.length === 0 ? (
          <p className="nb-type-small text-muted-foreground">{PEOPLE_COPY.nobodyToAdd}</p>
        ) : null}
        {pick.trim() && suggestions.length > 0 ? (
          <ul className="space-y-1" aria-label={PEOPLE_COPY.add}>
            {suggestions.map((person) => (
              <li key={person.id}>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  disabled={change.isPending || !people.data?.canShare}
                  onClick={() => change.mutate({ person_id: person.id, access: "review" })}
                >
                  {person.display_name}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {pick.includes("@") && suggestions.length === 0 ? (
          <p className="nb-type-small text-muted-foreground">{PEOPLE_COPY.membersOnly}</p>
        ) : null}
      </div>

      <p className="nb-type-small text-foreground">{PEOPLE_COPY.heading}</p>
      {choices.map((choice) => (
        <p key={choice.value} className="nb-type-small text-muted-foreground">
          {choice.label}: {choice.line}
        </p>
      ))}
      <p className="nb-type-small text-muted-foreground">{PEOPLE_COPY.summariesLine}</p>
      <ul className="space-y-2">
        {you ? (
          <li className="nb-type-small text-muted-foreground">
            {PEOPLE_COPY.you}{you.access ? ` · ${choices.find((choice) => choice.value === you.access)?.label ?? ""}` : ""}
          </li>
        ) : null}
        {onBoard.map((person) => (
          <li key={person.id} className="flex flex-col gap-2 rounded-md border border-border p-2">
            <span className="nb-type-small text-foreground">{person.display_name}</span>
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label={person.display_name} className="flex gap-1">
                {choices.map((choice) => (
                  <Button
                    key={choice.value}
                    size="sm"
                    variant={person.access === choice.value ? "secondary" : "outline"}
                    aria-pressed={person.access === choice.value}
                    disabled={change.isPending || !people.data?.canShare}
                    onClick={() => change.mutate({ person_id: person.id, access: choice.value })}
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={change.isPending || !people.data?.canShare}
                onClick={() => change.mutate({ person_id: person.id, access: "none" })}
              >
                {PEOPLE_COPY.remove}
              </Button>
            </div>
            <ConversationSwitch
              name={person.display_name}
              value={person.conversations ?? null}
              disabled={changeConversations.isPending || !people.data?.canShare}
              onChoose={(next) => changeConversations.mutate({ person_id: person.id, conversations: next })}
            />
          </li>
        ))}
      </ul>
      {people.data && onBoard.length === 0 ? (
        <p className="nb-type-small text-muted-foreground">{PEOPLE_COPY.empty}</p>
      ) : null}
      {problem ? <p className="nb-type-small text-foreground">{problem}</p> : null}
    </section>
  );
}
