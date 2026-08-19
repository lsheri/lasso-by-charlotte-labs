import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SessionHeader } from "@/components/layout/SessionHeader";
import { Wordmark } from "@/components/layout/Wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setActiveProfileId, useProfiles } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import {
  blockedStateFor,
  blockedStateFromRpcError,
  type BlockedState,
  type InviteState,
} from "@/lib/invite-state";
import { getInviteState, recordInviteBlocked } from "@/lib/invites.functions";
import { logEvent } from "@/lib/telemetry";

type JoinSearch = { code?: string | undefined; eng?: string | undefined };

export const Route = createFileRoute("/join")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): JoinSearch => ({
    code: typeof search["code"] === "string" ? search["code"] : undefined,
    eng: typeof search["eng"] === "string" ? search["eng"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Accept your invite | Lasso" },
      { name: "description", content: "Join your team's Lasso workspace with an invite link." },
      { property: "og:title", content: "Accept your invite | Lasso" },
      {
        property: "og:description",
        content: "Join your team's Lasso workspace with an invite link.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
});

const ROLE_WORD: Record<string, string> = {
  coach: "coach",
  em: "teammate",
  lead: "lead",
  admin: "admin",
};

/** Every accept state is one of these cards, so nothing can dead end. */
function StateCard({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8 rounded-[var(--radius)] border border-border bg-card px-6 py-6 shadow-card">
      <p className="micro-label">{label}</p>
      <h1 className="mt-2 page-title">{title}</h1>
      <div className="mt-3 space-y-3 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function useViewerEmail() {
  return useQuery({
    queryKey: ["viewer-email"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.email ?? null;
    },
    staleTime: 30_000,
  });
}

function JoinPage() {
  const { code, eng } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loadState = useServerFn(getInviteState);
  const reportBlocked = useServerFn(recordInviteBlocked);

  const { data: viewerEmail, isLoading: viewerLoading } = useViewerEmail();
  const { data: state, isLoading: stateLoading } = useQuery({
    queryKey: ["invite-state", code, eng],
    enabled: Boolean(code),
    queryFn: (): Promise<InviteState> =>
      loadState({ data: { code: code as string, ...(eng ? { eng } : {}) } }),
  });

  const [override, setOverride] = useState<BlockedState | null>(null);
  const blocked = override ?? (state ? blockedStateFor(state, viewerEmail ?? null) : null);

  // One content-free record per blocked view, never an address.
  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (!code || !blocked) return;
    const key = `${code}:${blocked}`;
    if (reported.current === key) return;
    reported.current = key;
    void reportBlocked({ data: { code, state: blocked } }).catch(() => {
      /* telemetry must never surface to the user */
    });
  }, [code, blocked, reportBlocked]);

  async function signOutAndStay() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({
      to: "/join",
      search: eng ? { code, eng } : { code },
      replace: true,
    });
  }

  const joinHref = `/join?${new URLSearchParams({
    ...(code ? { code } : {}),
    ...(eng ? { eng } : {}),
  }).toString()}`;

  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <>
        <SessionHeader />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4 pb-16 pt-[calc(4rem+env(safe-area-inset-top))]">
          <div className="w-full max-w-md">
            <Wordmark size="lg" />
            {children}
          </div>
        </main>
      </>
    );
  }

  if (!code) {
    return (
      <Shell>
        <StateCard label="Invite" title="This link is missing its code">
          <p>Ask whoever invited you for a fresh link, then open it again.</p>
        </StateCard>
      </Shell>
    );
  }

  if (stateLoading || viewerLoading || !state) {
    return (
      <Shell>
        <StateCard label="Invite" title="Checking your invite">
          <p>One moment.</p>
        </StateCard>
      </Shell>
    );
  }

  const org = state.org_name ?? "this workspace";
  const roleWord = ROLE_WORD[state.invited_role ?? ""] ?? "member";

  if (state.status === "not_found") {
    return (
      <Shell>
        <StateCard label="Invite" title="We could not find this invite">
          <p>The code may have been mistyped, or the link may be incomplete.</p>
          <p>Ask whoever invited you to send it again.</p>
        </StateCard>
      </Shell>
    );
  }

  if (state.status === "revoked") {
    return (
      <Shell>
        <StateCard label="Invite" title="This invite was withdrawn">
          <p>Whoever created it has since cancelled it. Nothing was shared with you.</p>
          <p>Ask {org} for a new one if you still need access.</p>
        </StateCard>
      </Shell>
    );
  }

  if (state.status === "used") {
    return (
      <Shell>
        <StateCard label="Invite" title="This invite has already been accepted">
          <p>Invites work once. If that was you, sign in with the account you used.</p>
          <Link to="/auth" className="inline-block text-accent-deep underline">
            Go to sign in
          </Link>
        </StateCard>
      </Shell>
    );
  }

  if (state.status === "expired") {
    return (
      <Shell>
        <StateCard label="Invite" title="This invite has expired">
          <p>Invites last 14 days. This one is past that, so it can no longer be used.</p>
          <p>Ask {org} for a fresh link.</p>
        </StateCard>
      </Shell>
    );
  }

  if (state.created_by_you) {
    return (
      <Shell>
        <StateCard label="Your invite" title="You created this invite">
          <p>
            {state.email
              ? `It is for ${state.email}. Share the link with them.`
              : "It is an open link. Share it with the person you want to invite."}
          </p>
          <p>Opening it yourself does nothing. You are already in {org}.</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(`${window.location.origin}${joinHref}`);
                toast.success("Invite link copied");
              }}
            >
              Copy link
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/overview" })}>
              Go to workspace
            </Button>
          </div>
        </StateCard>
      </Shell>
    );
  }

  if (!state.viewer.signed_in) {
    return (
      <Shell>
        <StateCard label="Invite" title={`You have been invited to ${org}`}>
          <p>You will join as a {roleWord}.</p>
          {state.is_email_bound ? (
            <p>
              This invite is locked to {state.email_hint ?? "one address"}. Sign in or create your
              account with that address, or it will not be accepted.
            </p>
          ) : (
            <p>Create an account or sign in, and you will land straight here again.</p>
          )}
          <div className="pt-1">
            <Button
              type="button"
              onClick={() => navigate({ to: "/auth", search: { next: joinHref } })}
            >
              Sign in or create an account
            </Button>
          </div>
        </StateCard>
      </Shell>
    );
  }

  if (blocked === "already_member") {
    return (
      <Shell>
        <StateCard label="Invite" title={`You are already in ${org}`}>
          <p>
            This account{viewerEmail ? `, ${viewerEmail},` : ""} already belongs to {org}, so there
            is nothing to accept.
          </p>
          <p>
            If the invite was meant for someone else, sign out and let them open the link. It stays
            valid until it expires.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" onClick={() => navigate({ to: "/overview" })}>
              Go to workspace
            </Button>
            <Button type="button" variant="outline" onClick={() => void signOutAndStay()}>
              Sign out and continue
            </Button>
          </div>
        </StateCard>
      </Shell>
    );
  }

  if (blocked === "mismatch") {
    return (
      <Shell>
        <StateCard label="Invite" title="This invite is for a different account">
          <p>
            This invite is for {state.email ?? state.email_hint ?? "another address"}. You are
            signed in as {viewerEmail ?? "another account"}.
          </p>
          <p>
            Nothing was shared with this account. The invite stays valid until it expires, so you
            can sign out and open it with the right one.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" onClick={() => void signOutAndStay()}>
              Sign out and continue
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/overview" })}>
              Go to workspace
            </Button>
          </div>
        </StateCard>
      </Shell>
    );
  }

  return (
    <Shell>
      <AcceptForm
        code={code}
        eng={eng}
        state={state}
        onBlocked={(next) => setOverride(next)}
      />
    </Shell>
  );
}

function AcceptForm({
  code,
  eng,
  state,
  onBlocked,
}: {
  code: string;
  eng: string | undefined;
  state: InviteState;
  onBlocked: (next: BlockedState) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const { data: existingProfiles } = useProfiles();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Someone who already has a profile shouldn't retype their name.
  useEffect(() => {
    const recent = existingProfiles?.[existingProfiles.length - 1];
    if (recent?.display_name) setDisplayName((current) => current || recent.display_name);
  }, [existingProfiles]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { data: profileId, error: joinError } = await supabase.rpc("join_org_with_invite", {
      p_display_name: displayName.trim(),
      p_code: code,
    });

    if (joinError || !profileId) {
      const message = joinError?.message ?? "Could not accept this invite.";
      const mapped = blockedStateFromRpcError(message);
      setPending(false);
      // A race, for instance a revoke between load and submit, must still land
      // on an honest card rather than a raw database message.
      if (mapped) onBlocked(mapped);
      else setError(message);
      return;
    }

    setActiveProfileId(profileId as string);

    const { data: invite } = await supabase
      .from("invites")
      .select("invited_role, org_id")
      .eq("code", code)
      .maybeSingle();
    const memberRole = invite?.invited_role ?? "coach";

    if (eng) {
      const { error: memberError } = await supabase.from("engagement_members").insert({
        engagement_id: eng,
        profile_id: profileId as string,
        member_role: memberRole,
      });
      if (memberError) {
        setError(memberError.message);
        setPending(false);
        return;
      }
    }

    if (invite?.org_id) logEvent("coach.joined", invite.org_id, { role: memberRole });

    await queryClient.invalidateQueries();
    setPending(false);
    if (eng && memberRole === "coach") {
      const { data: subjects } = await supabase
        .from("engagement_members")
        .select("profile_id")
        .eq("engagement_id", eng)
        .eq("member_role", "em");
      const only = (subjects ?? []).length === 1 ? (subjects ?? [])[0]?.profile_id : undefined;
      if (only) {
        navigate({
          to: "/coaching/$engagementId/$subjectId",
          params: { engagementId: eng, subjectId: only },
          replace: true,
        });
      } else {
        navigate({ to: "/coaching", replace: true });
      }
      return;
    }
    if (eng) navigate({ to: "/engagements/$id", params: { id: eng }, replace: true });
    else if (memberRole === "coach") navigate({ to: "/coaching", replace: true });
    else navigate({ to: "/work", replace: true });
  }

  return (
    <div className="mt-8 rounded-[var(--radius)] border border-border bg-card px-6 py-6 shadow-card">
      <div className="mb-4 rounded-[var(--radius)] border border-border bg-secondary px-4 py-3">
        {state.org_name ? <p className="micro-label">{state.org_name}</p> : null}
        <p className="mt-1 text-sm text-foreground">
          {state.engagement_title
            ? `You've been invited to ${state.invited_role === "coach" ? "coach on" : "join"} ${state.engagement_title}`
            : `You'll join as a ${ROLE_WORD[state.invited_role ?? ""] ?? "member"}`}
        </p>
      </div>

      <h1 className="page-title">Accept your invite</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {state.engagement_title
          ? "You'll land straight in the engagement you were invited to."
          : "Tell us how your name should appear to your team."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="join-name" className="micro-label">
            Your name
          </Label>
          <Input
            id="join-name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Alex Rivera"
          />
        </div>
        <Button type="submit" disabled={pending || !displayName.trim()}>
          {pending ? "Joining…" : "Join"}
        </Button>
      </form>

      {error ? (
        <p className="mt-4 rounded-[var(--radius)] border border-border bg-secondary px-4 py-3 text-sm text-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
