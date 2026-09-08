import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { SetupTools } from "@/components/onboarding/SetupTools";
import { ToolPicker } from "@/components/onboarding/ToolPicker";
import { Wordmark } from "@/components/layout/Wordmark";
import { SessionHeader } from "@/components/layout/SessionHeader";
import { EnterInviteCode } from "@/components/invites/EnterInviteCode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfile } from "@/hooks/use-profile";
import { readEduIntent, clearEduIntent } from "@/lib/edu-entry";
import { readPendingInvite } from "@/lib/pending-invite";
import { logEvent } from "@/lib/telemetry";
import {
  loadToolsUsed,
  saveToolsUsed,
  toolCountBucket,
  type ToolId,
} from "@/lib/onboarding-tools";

type OrgType = "company" | "personal" | "edu";

/** The RPC creates the org; the type is workspace settings we write after. */
async function applyOrgType(profileId: string, type: OrgType): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile?.org_id) return null;
  const { data: org } = await supabase
    .from("orgs")
    .select("settings")
    .eq("id", profile.org_id)
    .maybeSingle();
  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  await supabase
    .from("orgs")
    .update({ settings: { ...settings, type } })
    .eq("id", profile.org_id);
  return profile.org_id;
}

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    intent?: "company" | "personal" | "edu" | "invite" | undefined;
    setup?: boolean | undefined;
  } => {
    const intent = search["intent"];
    const setup = search["setup"] === true || search["setup"] === "1" ? { setup: true } : {};
    return {
      ...(intent === "company" || intent === "personal" || intent === "edu" || intent === "invite"
        ? { intent }
        : {}),
      ...setup,
    };
  },
  beforeLoad: async ({ search }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const profile = await fetchProfile();
    // `?setup=1` is how an existing member reopens the tool setup from Connectors.
    if (profile && !search.setup) throw redirect({ to: "/work" });
    // Someone who arrived on an invite should never be asked for the code
    // again. The accept page owns every invite state, including redeemed.
    if (!profile && !search.setup) {
      const pending = readPendingInvite();
      if (pending) {
        throw redirect({
          to: "/join",
          search: pending.eng ? { code: pending.code, eng: pending.eng } : { code: pending.code },
          replace: true,
        });
      }
    }
  },
  head: () => ({
    meta: [
      { title: "Set up your workspace | Lasso" },
      {
        name: "description",
        content: "Create a Lasso workspace or join your team with an invite code.",
      },
      { property: "og:title", content: "Set up your workspace | Lasso" },
      {
        property: "og:description",
        content: "Create a Lasso workspace or join your team with an invite code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  return <OnboardingInner />;
}


function OnboardingInner() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { intent, setup } = Route.useSearch();
  const [stage, setStage] = useState<"choose" | "setup" | "why" | "tools" | "capture">(
    setup ? "tools" : intent === "edu" || readEduIntent() ? "setup" : "choose",
  );
  const [tools, setTools] = useState<Set<ToolId>>(new Set());
  const [orgType, setOrgType] = useState<OrgType>(
    intent === "personal" ? "personal" : intent === "edu" || readEduIntent() ? "edu" : "company",
  );
  const [selected, setSelected] = useState<"company" | "personal" | "edu" | "invite" | null>(
    intent ?? (readEduIntent() ? "edu" : null),
  );
  const [displayName, setDisplayName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Returning members reopening setup from Connectors see their earlier picks.
  useEffect(() => {
    if (!setup) return;
    void loadToolsUsed().then((saved) => setTools(new Set(saved)));
  }, [setup]);

  function toggleTool(id: ToolId) {
    setTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function continueFromTools() {
    const picked = [...tools];
    const orgId = await saveToolsUsed(picked);
    if (orgId) {
      logEvent("onboarding.tools_selected", orgId, { count: toolCountBucket(picked.length) });
    }
    setStage("capture");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    // Redeeming an invite belongs to /join, which owns every honest state.
    // This surface only ever creates a workspace, so no database message
    // about invites can reach the screen from here.
    const { error: rpcError } = await supabase.rpc("create_org_with_profile", {
      p_display_name: displayName.trim(),
      p_org_name:
        orgType === "company"
          ? orgName.trim()
          : orgName.trim() || `${displayName.trim()}'s workspace`,
    });

    if (rpcError) {
      setError(rpcError.message);
      setPending(false);
      return;
    }

    const profile = await fetchProfile();
    if (profile) {
      const orgId = await applyOrgType(profile.id, orgType);
      if (orgId) logEvent("org.created", orgId, { org_type: orgType });
      clearEduIntent();
    }

    // Narrowed on purpose: only the keys this step can have changed.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["profiles"] }),
      queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] }),
      queryClient.invalidateQueries({ queryKey: ["work-items"] }),
      queryClient.invalidateQueries({ queryKey: ["engagements"] }),
    ]);
    setPending(false);
    setStage(orgType === "company" ? "why" : "tools");
  }

  function finish() {
    navigate({ to: "/work", replace: true });
  }

  if (stage === "why") {
    return (
      <>
        <SessionHeader />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4 py-16">
          <div className="w-full max-w-3xl">
            <Wordmark size="lg" />
            <p className="micro-label mt-6">Why Lasso</p>
            <h1 className="page-title mt-2">The point of all this</h1>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                [
                  "See your own thinking",
                  "your decisions, drafted from your real work, confirmed by you.",
                ],
                [
                  "Grow on purpose",
                  "coaching that finally has the full picture, without anyone reading your raw files.",
                ],
                [
                  "Own your record",
                  "private by default. You choose what's shared, piece by piece. It stays yours.",
                ],
              ].map(([title, body]) => (
                <div
                  key={title}
                  className="rounded-[var(--radius)] border border-border bg-card p-5 shadow-card"
                >
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex items-center gap-6">
              <Button type="button" onClick={() => setStage("tools")}>
                Continue
              </Button>
              <button
                type="button"
                onClick={finish}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                I'll do this later
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }


  if (stage === "tools") {
    return (
      <>
        <SessionHeader />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4 py-16">
          <div className="w-full max-w-3xl">
            <Wordmark size="lg" />
            <p className="micro-label mt-6">Step one</p>
            <h1 className="page-title mt-2">Where do you work with AI?</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Pick everything you use. We'll only set up what you choose, and nothing comes in
              until you say so.
            </p>

            <div className="mt-6">
              <ToolPicker selected={tools} onToggle={toggleTool} />
            </div>

            <div className="mt-8 flex items-center gap-6">
              <Button type="button" onClick={() => void continueFromTools()}>
                Continue
              </Button>
              <button
                type="button"
                onClick={finish}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                I'll do this later
              </button>
            </div>
            <ProgressDots total={2} current={0} />
          </div>
        </main>
      </>
    );
  }

  if (stage === "capture") {
    return (
      <>
        <SessionHeader />
        <main className="flex min-h-[calc(100vh-4rem)] justify-center bg-background px-4 py-16">
          <div className="w-full max-w-3xl">
            <Wordmark size="lg" />
            <p className="micro-label mt-6">Step two</p>
            <h1 className="page-title mt-2">Set up your first work</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Start with one source. The rest is waiting for you in your workspace, on the
              getting started card.
            </p>

            <div className="mt-6">
              <SetupTools tools={[...tools]} />
            </div>

            <div className="mt-8 flex items-center gap-6">
              <Button type="button" onClick={finish}>
                Go to my work
              </Button>
              <button
                type="button"
                onClick={finish}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                I'll do this later
              </button>
            </div>
            <ProgressDots total={2} current={1} />
          </div>
        </main>
      </>
    );
  }


  if (stage === "choose") {
    return (
      <>
        <SessionHeader />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4 py-16">
          <div className="w-full max-w-3xl">
            <Wordmark size="lg" />
            <p className="micro-label mt-6">Welcome</p>
            <h1 className="page-title mt-2">Who is this for?</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              You can change this later. It only decides who owns the workspace.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {(
                [
                  [
                    "company",
                    "For my company",
                    "Your organization owns the tenancy. Each person's work stays private to them.",
                  ],
                  [
                    "personal",
                    "Just for me",
                    "Your work, your record. You own everything here. Invite a coach whenever you're ready.",
                  ],
                ] as const
              ).map(([value, title, body]) => (
                <div
                  key={value}
                  className={
                    selected === value
                      ? "flex flex-col rounded-[var(--radius)] border border-accent bg-card p-5 shadow-card ring-1 ring-accent"
                      : "flex flex-col rounded-[var(--radius)] border border-border bg-card p-5 shadow-card"
                  }
                >
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{body}</p>
                  <Button
                    type="button"
                    className="mt-4"
                    onClick={() => {
                      setSelected(value);
                      setOrgType(value);
                      setStage("setup");
                    }}
                  >
                    Continue
                  </Button>
                  <Link
                    to="/trust"
                    className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    How your data works →
                  </Link>
                </div>
              ))}

              <div
                className={
                  selected === "invite"
                    ? "flex flex-col rounded-[var(--radius)] border border-accent bg-card p-5 shadow-card ring-1 ring-accent"
                    : "flex flex-col rounded-[var(--radius)] border border-border bg-card p-5 shadow-card"
                }
              >
                <p className="text-sm font-medium text-foreground">I have an invite</p>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">
                  Someone already set up a workspace for you. Paste the code or link they sent.
                </p>
                <div className="mt-4">
                  <EnterInviteCode label="Invite code or link" bare />
                </div>
                <Link
                  to="/trust"
                  className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  How your data works →
                </Link>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SessionHeader />
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4 py-16">
        <div className="w-full max-w-md">
          <Wordmark size="lg" />

          <div className="mt-6 rounded-[var(--radius)] border border-border bg-card p-6 shadow-card">
            <p className="micro-label">
              {orgType === "company"
                ? "For my company"
                : orgType === "edu"
                  ? "For my school work"
                  : "Just for me"}
            </p>
            <h1 className="page-title mt-2">Set up your workspace</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {orgType !== "company"
                ? "One detail and you're in. You can change it later."
                : "Two details and you're in. You can change them later."}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="display-name" className="micro-label">
                  Display name
                </Label>
                <Input
                  id="display-name"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jordan Reyes"
                />
              </div>

              {orgType === "company" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="org-name" className="micro-label">
                    Workspace name
                  </Label>
                  <Input
                    id="org-name"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Charlotte Labs"
                  />
                </div>
              ) : null}

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Setting up…" : "Create workspace"}
              </Button>
              <button
                type="button"
                onClick={() => setStage("choose")}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                ← Back
              </button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
