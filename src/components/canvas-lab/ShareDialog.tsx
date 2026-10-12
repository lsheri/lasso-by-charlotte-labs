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
import { INVITE_COPY, inviteResultLine, looksLikeEmail } from "@/lib/board-invites-shared";
import { inviteToBoard, listBoardInvites, withdrawBoardInvite } from "@/lib/board-invites.functions";

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
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-foreground">
              Link
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
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-foreground">
        Partner
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

      <p className="text-sm text-muted-foreground">
        Sees only the work you place on this board.
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
        <span className="text-sm text-muted-foreground">{partnerShareLabel(share)}</span>
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
      {problem ? <p className="text-sm text-foreground" role="alert">{problem}</p> : null}
      {share.bound ? null : (
        <p className="text-sm text-muted-foreground">Nobody there has opened this yet.</p>
      )}
    </li>
  );
}

export const PEOPLE_COPY = {
  heading: "People",
  you: "You",
  add: "Add people by name or email",
  view: "Viewer",
  multiplayer: "Collaborator",
  viewLine: "Opens the board and reads the cards",
  multiplayerLine: "Also adds and arranges work",
  remove: "Remove",
  membersOnly: "Only people in this workspace can be added here.",
  nobodyToAdd: "Nobody else in your workspace yet.",
  problem: "That could not be changed.",
  summaries: "Summaries",
  full: "Full conversations",
  summariesLine: "Can ask Lasso about the AI work, can't open the conversations",
  fullLine: "Can open the conversations",
} as const;

const LEVEL_CHOICES = [
  { value: "review", label: PEOPLE_COPY.view, title: PEOPLE_COPY.viewLine },
  { value: "work", label: PEOPLE_COPY.multiplayer, title: PEOPLE_COPY.multiplayerLine },
] as const;
const CONVERSATION_CHOICES = [
  { value: "summaries", label: PEOPLE_COPY.summaries, title: PEOPLE_COPY.summariesLine },
  { value: "full", label: PEOPLE_COPY.full, title: PEOPLE_COPY.fullLine },
] as const;

function SegmentedChoice<T extends string>({ name, value, choices, disabled, onChoose }: {
  name: string;
  value: T | null;
  choices: readonly { value: T; label: string; title: string }[];
  disabled: boolean;
  onChoose: (next: T) => void;
}) {
  return (
    <div role="group" aria-label={name} className="flex flex-wrap gap-1">
      {choices.map((choice) => (
        <Button key={choice.value} size="sm"
          variant={value === choice.value ? "ink" : "ghost"}
          className="text-sm"
          title={choice.title} aria-pressed={value === choice.value}
          disabled={disabled} onClick={() => onChoose(choice.value)}>
          {value === choice.value ? <span aria-hidden="true" data-selected-check="true"><GraphiteIcon name="check" size={16} /></span> : null}
          {choice.label}
        </Button>
      ))}
    </div>
  );
}

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
  return <SegmentedChoice name={`${name} conversations`} value={value}
    choices={CONVERSATION_CHOICES} disabled={disabled} onChoose={onChoose} />;
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
  const setConversations = useServerFn(setPersonConversationsFn);
  const invite = useServerFn(inviteToBoard);
  const listInvites = useServerFn(listBoardInvites);
  const withdraw = useServerFn(withdrawBoardInvite);
  const invitesKey = ["board-invites", engagementId] as const;
  const [pick, setPick] = useState("");
  const [addLevel, setAddLevel] = useState<EngagementAccessChoice>("review");
  const [addConversations, setAddConversations] = useState<ConversationAccess>("summaries");
  const [inviteLine, setInviteLine] = useState<string | null>(null);
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
    mutationFn: (input: { person_id: string; access: EngagementAccessChoice | "none"; fromAdd?: boolean }) =>
      setAccess({
        data: {
          engagement_id: engagementId,
          person_id: input.person_id,
          access: input.access,
          ...(profileId ? { profile_id: profileId } : {}),
        },
      }),
    onSuccess: async (answer, input) => {
      setProblem(answer.status === "done" ? null : PEOPLE_COPY.problem);
      if (answer.status === "done") setPick("");
      // SH-5c: a person added from the add row takes the picked conversations too.
      if (answer.status === "done" && input.fromAdd && addConversations !== "summaries") {
        await setConversations({
          data: {
            engagement_id: engagementId,
            person_id: input.person_id,
            conversations: addConversations,
            ...(profileId ? { profile_id: profileId } : {}),
          },
        }).catch(() => setProblem(PEOPLE_COPY.problem));
      }
      await queryClient.invalidateQueries({ queryKey: key });
    },
    onError: () => setProblem(PEOPLE_COPY.problem),
  });

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

  const invites = useQuery({
    queryKey: invitesKey,
    queryFn: () => listInvites({ data: { engagementId } }),
    enabled: open && !!engagementId,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const sendInvite = useMutation({
    mutationFn: (email: string) =>
      invite({ data: { engagementId, email, level: addLevel, conversations: addConversations } }),
    onMutate: () => {
      setProblem(null);
      setInviteLine(null);
    },
    onSuccess: async (answer) => {
      if (!answer.ok) {
        setProblem(answer.error);
        return;
      }
      setPick("");
      setInviteLine(inviteResultLine(answer));
      await invites.refetch();
    },
    onError: () => setProblem(PEOPLE_COPY.problem),
  });
  const withdrawOne = useMutation({
    mutationFn: (inviteId: string) => withdraw({ data: { inviteId } }),
    onSuccess: async (answer) => {
      setProblem(answer.ok ? null : answer.error);
      await invites.refetch();
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
  const typed = pick.trim();
  const inviteEmail = looksLikeEmail(typed) && suggestions.length === 0 ? typed : null;
  const openInvites = invites.data ?? [];
  return (
    <section className="flex flex-col gap-3" aria-label={PEOPLE_COPY.heading}>
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-foreground">{PEOPLE_COPY.heading}</p>
      <div className="flex flex-col gap-2">
        <label className="text-sm text-muted-foreground" htmlFor="share-person">
          {PEOPLE_COPY.add}
        </label>
        <div className="flex flex-wrap items-center gap-2">
        <Input
          className="min-w-0 flex-1 basis-32"
          id="share-person"
          value={pick}
          autoComplete="off"
          disabled={people.isPending || change.isPending || sendInvite.isPending || !people.data?.canShare}
          onChange={(event) => {
            setPick(event.target.value);
            setInviteLine(null);
          }}
        />
        <SegmentedChoice name="New person level" value={addLevel} choices={LEVEL_CHOICES}
          disabled={change.isPending || !people.data?.canShare}
          onChoose={setAddLevel} />
        </div>
        <SegmentedChoice name="New person conversations" value={addConversations}
          choices={CONVERSATION_CHOICES} disabled={change.isPending || !people.data?.canShare}
          onChoose={setAddConversations} />
        {people.data && canPick.length === 0 && !inviteEmail ? (
          <p className="text-sm text-muted-foreground">{PEOPLE_COPY.nobodyToAdd}</p>
        ) : null}
        {pick.trim() && suggestions.length > 0 ? (
          <ul className="space-y-1" aria-label={PEOPLE_COPY.add}>
            {suggestions.map((person) => (
              <li key={person.id}>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  disabled={change.isPending || !people.data?.canShare}
                  onClick={() => change.mutate({ person_id: person.id, access: addLevel, fromAdd: true })}
                >
                  {person.display_name}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {inviteEmail ? (
          <ul className="space-y-1" aria-label={PEOPLE_COPY.add}>
            <li>
              <Button
                variant="ghost"
                className="w-full justify-start"
                disabled={sendInvite.isPending || !people.data?.canShare}
                onClick={() => sendInvite.mutate(inviteEmail)}
              >
                {INVITE_COPY.invite(inviteEmail)}
              </Button>
            </li>
          </ul>
        ) : null}
        {inviteLine ? <p className="text-sm text-muted-foreground" role="status">{inviteLine}</p> : null}
      </div>

      <ul className="space-y-2">
        {you ? (
          <li className="text-sm text-muted-foreground">
            {PEOPLE_COPY.you}
          </li>
        ) : null}
        {onBoard.map((person) => (
          <li key={person.id} className="flex flex-col gap-2 rounded-md border border-border p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-foreground">{person.display_name}</span>
              <div className="flex flex-wrap items-center gap-1">
              <SegmentedChoice name={person.display_name} value={person.access}
                choices={LEVEL_CHOICES} disabled={change.isPending || !people.data?.canShare}
                onChoose={(access) => change.mutate({ person_id: person.id, access })} />
              <Button
                size="sm"
                variant="ghost"
                disabled={change.isPending || !people.data?.canShare}
                onClick={() => change.mutate({ person_id: person.id, access: "none" })}
              >
                {PEOPLE_COPY.remove}
              </Button>
            </div>
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
      {openInvites.length > 0 ? (
        <div className="flex flex-col gap-2" aria-label={INVITE_COPY.invitedHeading} role="group">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-foreground">{INVITE_COPY.invitedHeading}</p>
          <ul className="space-y-2">
            {openInvites.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-foreground">{row.email}</span>
                  <span className="text-sm text-muted-foreground">
                    {row.level === "work" ? PEOPLE_COPY.multiplayer : PEOPLE_COPY.view} · {row.conversations === "full" ? PEOPLE_COPY.full : PEOPLE_COPY.summaries} · {row.status === "pending_approval" ? INVITE_COPY.statePending : INVITE_COPY.stateSent}
                  </span>
                </div>
                <Button size="sm" variant="ghost" disabled={withdrawOne.isPending}
                  onClick={() => withdrawOne.mutate(row.id)}>
                  {INVITE_COPY.withdraw}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {problem ? <p className="text-sm text-foreground">{problem}</p> : null}
    </section>
  );
}
