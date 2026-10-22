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
import { Checkbox } from "@/components/ui/checkbox";
import {
  ACCESS_LEVEL_DISPLAY,
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
import { INVITE_COPY, inviteCountBand, parseEmailList } from "@/lib/board-invites-shared";
import { Textarea } from "@/components/ui/textarea";
import { inviteToBoard, listBoardInvites, withdrawBoardInvite } from "@/lib/board-invites.functions";

export function ShareDialog({
  engagementId,
  profileId,
}: {
  engagementId: string;
  profileId: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  // PERF-2c: one event per closed-to-open transition, no dims. Loaded on
  // demand so the dialog never pulls the server-function graph at import.
  function handleOpenChange(next: boolean) {
    if (next && !open) {
      void (async () => {
        const [{ ensureProfileState }, { logEvent }] = await Promise.all([
          import("@/hooks/use-profile"),
          import("@/lib/telemetry"),
        ]);
        const { profiles } = await ensureProfileState();
        const orgId = profiles.find((p) => p.id === profileId)?.org_id;
        if (orgId) logEvent("board.share_opened", orgId, {});
      })().catch(() => {});
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

          <section className="flex flex-col gap-3 border-t border-border pt-4" aria-label={PEOPLE_COPY.linkHeading}>
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-foreground">{PEOPLE_COPY.linkHeading}</p>
            <p className="text-sm text-muted-foreground">{SHARE3_COPY.linkLine}</p>
            <p className="text-sm text-muted-foreground">{PEOPLE_COPY.linkLine}</p>
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


/** Rows shown in the picker before anything is typed. */
const BROWSE_CAP = 6;

export const PEOPLE_COPY = {
  heading: "People",
  you: "You",
  add: "Add people by name or email",
  view: ACCESS_LEVEL_DISPLAY.review.label,
  multiplayer: ACCESS_LEVEL_DISPLAY.work.label,
  viewLine: ACCESS_LEVEL_DISPLAY.review.line,
  multiplayerLine: ACCESS_LEVEL_DISPLAY.work.line,
  remove: "Remove",
  ownerRemoveTitle: "The owner of a board cannot be removed from it. Archive the board instead.",
  membersOnly: "Only people in this workspace can be added here.",
  nobodyToAdd: "Nobody else in your workspace yet.",
  options: "People you can add",
  moreToFind: (n: number) => `and ${n} more, type to find them`,
  problem: "That could not be changed.",
  summaries: "Summaries",
  full: "Full conversations",
  summariesLine: "Can ask Lasso about the AI work, can't open the conversations",
  fullLine: "Can open the conversations",
  whoHasAccess: "Who has access",
  summariesOnly: "Share summaries only instead of full transcripts",
  inviteOutside: (email: string) => `Invite ${email} from outside`,
  pendingTag: "Pending",
  added: (when: string) => `added ${when}`,
  noMatch: "Nobody here by that name. Type a full email to invite someone from outside.",
  linkHeading: "Link",
  linkLine: "Anyone with the link can view the board read-only and will not be identified.",
} as const;

/** SHARE-3: the three ways to share, each said before it is used. */
export const SHARE3_COPY = {
  intro: "Choose how someone gets to this board. Each option says what it does.",
  settingsHeading: "Access",
  levelLine: {
    review: "Can open the board and read every card.",
    work: "Can open the board, add cards and edit them.",
  },
  rosterHeading: "People in this workspace",
  rosterLine: "Pick someone already in your workspace. They get an email and the board appears in their sidebar.",
  rosterPlaceholder: "Find someone by name",
  rosterNoMatch: "Nobody here by that name. To invite someone from outside, use the email field below.",
  rosterResults: "Results for people in this workspace",
  picked: (names: string[]) => `Chosen: ${names.join(", ")}`,
  emailHeading: "Invite by email",
  emailLineBusiness: "For people outside your workspace. Enter one address or several, separated by commas. Each person gets an email with a link to accept.",
  emailLineIndividual: "Enter one address or several, separated by commas. Each person gets an email with a link to accept the board.",
  emailField: "Email addresses",
  emailPlaceholder: "name@example.com, another@example.com",
  emailResults: "Results for email invites",
  colleagueHelper: (address: string) => `${address} is already in your workspace. Add them from the list above.`,
  colleagueHelperIndividual: (address: string) => `${address} is already in this workspace.`,
  colleagueFailed: "Already in this workspace. Add them from the list above.",
  overCap: "Up to 20 addresses per Send. The rest stay in the field for the next Send.",
  send: "Send",
  sending: "Sending",
  linkLine: "Anyone with the link can view this board. No account needed. They cannot edit, and the link expires.",
  outcome: {
    added: "Added. They get an email.",
    sent: "Sent",
    not_emailed: "Invite created, email did not go",
    pending: "Waiting for an admin to approve",
    already: "Already invited",
    invalid: "Not a full email address",
    over_cap: "Not sent yet, over 20 in one Send",
    colleague: "Already in this workspace. Add them from the list above.",
    refused: "Not sent",
  },
} as const;

type SendOutcome = keyof typeof SHARE3_COPY.outcome;
type SendResult = { label: string; outcome: SendOutcome; detail?: string };

function SendResults({ results, label }: { results: SendResult[]; label: string }) {
  if (results.length === 0) return null;
  return (
    <ul className="space-y-1" aria-label={label} role="status">
      {results.map((result, index) => (
        <li key={`${result.label}-${index}`} data-send-outcome={result.outcome} className="text-sm text-muted-foreground">
          <span className="text-foreground">{result.label}</span>
          {": "}
          {SHARE3_COPY.outcome[result.outcome]}
          {result.outcome === "refused" && result.detail ? `. ${result.detail}` : ""}
        </li>
      ))}
    </ul>
  );
}

const LEVEL_CHOICES = [
  { value: "review", label: PEOPLE_COPY.view, title: PEOPLE_COPY.viewLine },
  { value: "work", label: PEOPLE_COPY.multiplayer, title: PEOPLE_COPY.multiplayerLine },
] as const;

const CONVERSATION_CHOICES = [
  { value: "summaries", label: PEOPLE_COPY.summaries, title: PEOPLE_COPY.summariesLine },
  { value: "full", label: PEOPLE_COPY.full, title: PEOPLE_COPY.fullLine },
] as const;

function addedWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

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

/**
 * SHARE-2: people first. One box finds anyone in the workspace by name or
 * address; a full address that matches nobody becomes an outside invite. The
 * person choosing never has to know which of the two paths runs.
 */
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
  const [picked, setPicked] = useState<string[]>([]);
  const [emailText, setEmailText] = useState("");
  const [addLevel, setAddLevel] = useState<EngagementAccessChoice>("review");
  // Full transcripts unless the person sharing chooses otherwise. Always
  // passed explicitly: the database default is summaries.
  const [summariesOnly, setSummariesOnly] = useState(false);
  const addConversations: ConversationAccess = summariesOnly ? "summaries" : "full";
  const [peopleResults, setPeopleResults] = useState<SendResult[]>([]);
  const [emailResults, setEmailResults] = useState<SendResult[]>([]);
  const [sendingPeople, setSendingPeople] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
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
  const withdrawOne = useMutation({
    mutationFn: (inviteId: string) => withdraw({ data: { inviteId } }),
    onSuccess: async (answer) => {
      setProblem(answer.ok ? null : answer.error);
      await invites.refetch();
    },
    onError: () => setProblem(PEOPLE_COPY.problem),
  });

  const canShare = Boolean(people.data?.canShare);
  const ownerId = people.data?.ownerId ?? null;
  // Older payloads carry no tier; they always offered the roster.
  const hasRoster = people.data?.workspaceTier !== "individual";
  const rows = people.data?.people ?? [];
  const you = rows.find((person) => person.isYou);
  const onBoard = rows.filter((person) => !person.isYou && person.access !== null);
  const canPick = rows.filter((person) => !person.isYou && person.access === null);
  const typed = pick.trim();
  const needle = typed.toLocaleLowerCase();
  const suggestions = typed
    ? canPick.filter(
        (person) =>
          person.display_name.toLocaleLowerCase().includes(needle) ||
          (person.email ?? "").toLocaleLowerCase().includes(needle),
      )
    : canPick.slice(0, BROWSE_CAP);
  // With the box empty, show who can be added so the capability is visible.
  const moreToFind = typed ? 0 : Math.max(0, canPick.length - BROWSE_CAP);
  // An address that belongs to anyone in the workspace never goes to the
  // outside invite: the database refuses it. Point at the list instead.
  const workspaceEmails = new Set(rows.map((person) => (person.email ?? "").toLocaleLowerCase()).filter(Boolean));
  const parsed = parseEmailList(emailText);
  const colleagueTyped = parsed.valid.filter((address) => workspaceEmails.has(address));
  const openInvites = invites.data ?? [];
  const pendingEmails = new Set(openInvites.map((row) => row.email.toLocaleLowerCase()));
  const busy = people.isPending || sendingPeople || sendingEmails || !canShare;
  const pickedPeople = rows.filter((person) => picked.includes(person.id));

  function recordBatch(results: SendResult[]) {
    const sent = results.filter((r) => r.outcome === "sent" || r.outcome === "not_emailed" || r.outcome === "pending").length;
    const failed = results.filter((r) => r.outcome === "refused").length;
    const skipped = results.length - sent - failed;
    void (async () => {
      const [{ ensureProfileState }, { logEvent }] = await Promise.all([
        import("@/hooks/use-profile"),
        import("@/lib/telemetry"),
      ]);
      const { profiles } = await ensureProfileState();
      const orgId = profiles.find((p) => p.id === profileId)?.org_id;
      if (orgId) {
        logEvent("board.invite_batch_sent", orgId, {
          count_band: inviteCountBand(results.length),
          sent,
          failed,
          skipped,
        });
      }
    })().catch(() => {});
  }

  async function sendToPeople() {
    if (pickedPeople.length === 0) return;
    setSendingPeople(true);
    setProblem(null);
    const results: SendResult[] = [];
    const keep: string[] = [];
    for (const person of pickedPeople) {
      const label = person.display_name || person.email || "";
      try {
        const answer = await setAccess({
          data: {
            engagement_id: engagementId,
            person_id: person.id,
            access: addLevel,
            conversations: addConversations,
            ...(profileId ? { profile_id: profileId } : {}),
          },
        });
        if (answer.status !== "done") {
          results.push({ label, outcome: "refused", detail: PEOPLE_COPY.problem });
          keep.push(person.id);
          continue;
        }
        await setConversations({
          data: {
            engagement_id: engagementId,
            person_id: person.id,
            conversations: addConversations,
            ...(profileId ? { profile_id: profileId } : {}),
          },
        }).catch(() => undefined);
        results.push({ label, outcome: "added" });
      } catch {
        results.push({ label, outcome: "refused", detail: PEOPLE_COPY.problem });
        keep.push(person.id);
      }
    }
    setPicked(keep);
    if (keep.length === 0) setPick("");
    setPeopleResults(results);
    setSendingPeople(false);
    recordBatch(results);
    await queryClient.invalidateQueries({ queryKey: key });
  }

  async function sendToEmails() {
    const { valid, invalid, overCap } = parseEmailList(emailText);
    if (valid.length === 0 && invalid.length === 0) return;
    setSendingEmails(true);
    setProblem(null);
    const results: SendResult[] = [];
    const keep: string[] = [...invalid, ...overCap];
    for (const address of invalid) results.push({ label: address, outcome: "invalid" });
    for (const address of valid) {
      if (workspaceEmails.has(address)) {
        results.push({ label: address, outcome: hasRoster ? "colleague" : "refused", detail: SHARE3_COPY.colleagueFailed });
        keep.push(address);
        continue;
      }
      if (pendingEmails.has(address)) {
        results.push({ label: address, outcome: "already" });
        continue;
      }
      try {
        const answer = await invite({
          data: { engagementId, email: address, level: addLevel, conversations: addConversations },
        });
        if (!answer.ok) {
          results.push({ label: address, outcome: "refused", detail: answer.error });
          keep.push(address);
        } else if (answer.status === "pending_approval") {
          results.push({ label: address, outcome: "pending" });
        } else {
          results.push({ label: address, outcome: answer.emailed ? "sent" : "not_emailed" });
        }
      } catch {
        results.push({ label: address, outcome: "refused", detail: PEOPLE_COPY.problem });
        keep.push(address);
      }
    }
    for (const address of overCap) results.push({ label: address, outcome: "over_cap" });
    setEmailText(keep.join(", "));
    setEmailResults(results);
    setSendingEmails(false);
    recordBatch(results);
    await invites.refetch();
  }

  return (
    <section className="flex flex-col gap-5" aria-label={PEOPLE_COPY.heading}>
      <p className="text-sm text-muted-foreground">{SHARE3_COPY.intro}</p>

      <div className="flex flex-col gap-2 rounded-md border border-border p-3" aria-label={SHARE3_COPY.settingsHeading} role="group">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-foreground">{SHARE3_COPY.settingsHeading}</p>
        <SegmentedChoice name="New person level" value={addLevel} choices={LEVEL_CHOICES}
          disabled={!canShare || busy}
          onChoose={setAddLevel} />
        <p className="text-sm text-muted-foreground">{SHARE3_COPY.levelLine[addLevel]}</p>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={summariesOnly}
            disabled={!canShare}
            onCheckedChange={(next) => setSummariesOnly(next === true)}
            aria-label={PEOPLE_COPY.summariesOnly}
          />
          {PEOPLE_COPY.summariesOnly}
        </label>
      </div>

      {hasRoster ? (
        <div className="flex flex-col gap-2" role="group" aria-label={SHARE3_COPY.rosterHeading} data-share-section="roster">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-foreground">{SHARE3_COPY.rosterHeading}</p>
          <p className="text-sm text-muted-foreground">{SHARE3_COPY.rosterLine}</p>
          <label className="sr-only" htmlFor="share-person">{PEOPLE_COPY.add}</label>
          <Input
            id="share-person"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls="share-person-options"
            placeholder={SHARE3_COPY.rosterPlaceholder}
            value={pick}
            autoComplete="off"
            disabled={busy}
            onChange={(event) => setPick(event.target.value)}
          />
          {suggestions.length > 0 ? (
            <ul id="share-person-options" role="listbox" aria-multiselectable="true" aria-label={PEOPLE_COPY.options}
              className="space-y-1 rounded-md border border-border p-1">
              {suggestions.map((person) => {
                const selected = picked.includes(person.id);
                return (
                  <li key={person.id} role="option" aria-selected={selected}>
                    <Button
                      variant={selected ? "secondary" : "ghost"}
                      className="h-auto w-full flex-col items-start py-1.5"
                      disabled={busy}
                      aria-pressed={selected}
                      onClick={() =>
                        setPicked((current) =>
                          current.includes(person.id) ? current.filter((id) => id !== person.id) : [...current, person.id],
                        )
                      }
                    >
                      <span className="text-sm text-foreground">{person.display_name}</span>
                      {person.email ? <span className="text-sm text-muted-foreground">{person.email}</span> : null}
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {moreToFind > 0 ? (
            <p className="text-sm text-muted-foreground">{PEOPLE_COPY.moreToFind(moreToFind)}</p>
          ) : null}
          {typed && suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{SHARE3_COPY.rosterNoMatch}</p>
          ) : null}
          {people.data && canPick.length === 0 && !typed ? (
            <p className="text-sm text-muted-foreground">{PEOPLE_COPY.nobodyToAdd}</p>
          ) : null}
          {pickedPeople.length > 0 ? (
            <p className="text-sm text-muted-foreground">{SHARE3_COPY.picked(pickedPeople.map((p) => p.display_name))}</p>
          ) : null}
          <Button
            size="sm"
            className="self-start"
            disabled={busy || pickedPeople.length === 0}
            onClick={() => void sendToPeople()}
            data-share-send="roster"
          >
            {sendingPeople ? SHARE3_COPY.sending : SHARE3_COPY.send}
          </Button>
          <SendResults results={peopleResults} label={SHARE3_COPY.rosterResults} />
        </div>
      ) : null}

      <div className="flex flex-col gap-2" role="group" aria-label={SHARE3_COPY.emailHeading} data-share-section="email">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-foreground">{SHARE3_COPY.emailHeading}</p>
        <p className="text-sm text-muted-foreground">{hasRoster ? SHARE3_COPY.emailLineBusiness : SHARE3_COPY.emailLineIndividual}</p>
        <Textarea
          id="share-emails"
          aria-label={SHARE3_COPY.emailField}
          placeholder={SHARE3_COPY.emailPlaceholder}
          rows={2}
          value={emailText}
          disabled={busy}
          onChange={(event) => setEmailText(event.target.value)}
        />
        {colleagueTyped.map((address) => (
          <p key={address} className="text-sm text-muted-foreground">
            {hasRoster ? SHARE3_COPY.colleagueHelper(address) : SHARE3_COPY.colleagueHelperIndividual(address)}
          </p>
        ))}
        {parsed.overCap.length > 0 ? (
          <p className="text-sm text-muted-foreground">{SHARE3_COPY.overCap}</p>
        ) : null}
        <Button
          size="sm"
          className="self-start"
          disabled={busy || (parsed.valid.length === 0 && parsed.invalid.length === 0)}
          onClick={() => void sendToEmails()}
          data-share-send="email"
        >
          {sendingEmails ? SHARE3_COPY.sending : SHARE3_COPY.send}
        </Button>
        <SendResults results={emailResults} label={SHARE3_COPY.emailResults} />
      </div>

      {problem ? <p className="text-sm text-foreground" role="alert">{problem}</p> : null}

      <p className="font-mono text-xs uppercase tracking-[0.08em] text-foreground">{PEOPLE_COPY.whoHasAccess}</p>
      <ul className="space-y-2" aria-label={PEOPLE_COPY.whoHasAccess}>
        {you ? (
          <li className="text-sm text-muted-foreground">
            {PEOPLE_COPY.you}
          </li>
        ) : null}
        {onBoard.map((person) => {
          const when = addedWhen(person.addedAt);
          // The database refuses to remove the owner (errcode 53400); the
          // control is disabled with the reason instead of failing on click.
          const isOwner = ownerId !== null && person.id === ownerId;
          return (
            <li key={person.id} data-share-row="member" className="flex flex-col gap-2 rounded-md border border-border p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm text-foreground">{person.display_name}</span>
                  <span className="text-sm text-muted-foreground">
                    {[person.email, person.conversations === "full" ? PEOPLE_COPY.full : PEOPLE_COPY.summaries, when ? PEOPLE_COPY.added(when) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <SegmentedChoice name={person.display_name} value={person.access}
                    choices={LEVEL_CHOICES} disabled={change.isPending || !canShare}
                    onChoose={(access) => change.mutate({ person_id: person.id, access })} />
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={change.isPending || !canShare || isOwner}
                    title={isOwner ? PEOPLE_COPY.ownerRemoveTitle : undefined}
                    onClick={() => change.mutate({ person_id: person.id, access: "none" })}
                  >
                    {PEOPLE_COPY.remove}
                  </Button>
                </div>
              </div>
              <ConversationSwitch
                name={person.display_name}
                value={person.conversations ?? "summaries"}
                disabled={changeConversations.isPending || !canShare}
                onChoose={(conversations) => changeConversations.mutate({ person_id: person.id, conversations })}
              />
            </li>
          );
        })}
        {openInvites.map((row) => {
          const when = addedWhen(row.createdAt);
          return (
            <li key={row.id} data-share-row="invite" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2">
              <div className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <span className="truncate">{row.email}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs uppercase text-muted-foreground">
                    {PEOPLE_COPY.pendingTag}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {[
                    row.level === "work" ? PEOPLE_COPY.multiplayer : PEOPLE_COPY.view,
                    row.conversations === "full" ? PEOPLE_COPY.full : PEOPLE_COPY.summaries,
                    row.status === "pending_approval" ? INVITE_COPY.statePending : INVITE_COPY.stateSent,
                    when ? PEOPLE_COPY.added(when) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <Button size="sm" variant="ghost" disabled={withdrawOne.isPending}
                onClick={() => withdrawOne.mutate(row.id)}>
                {INVITE_COPY.withdraw}
              </Button>
            </li>
          );
        })}
      </ul>
      {problem ? <p className="text-sm text-foreground" role="alert">{problem}</p> : null}
    </section>
  );
}
