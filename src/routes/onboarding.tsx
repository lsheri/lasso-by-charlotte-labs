import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { StepRail } from "@/components/onboarding/StepRail";
import { SetupTools } from "@/components/onboarding/SetupTools";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { readOnboardingUi } from "@/lib/onboarding-ui";
import { ToolPicker } from "@/components/onboarding/ToolPicker";
import { SessionHeader } from "@/components/layout/SessionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { AUTH_USER_KEY, fetchProfile, type Profile } from "@/hooks/use-profile";
import {
  readEduIntent,
  clearEduIntent,
  readSignupSource,
  clearSignupSource,
} from "@/lib/edu-entry";
import { readPendingInvite } from "@/lib/pending-invite";
import { useServerFn } from "@tanstack/react-start";
import { lookupActivationKeyFn, redeemActivationKeyFn } from "@/lib/activation-keys.functions";
import { cleanActivationKey, clearActivationKey, readActivationKey } from "@/lib/key-entry";
import { logEvent } from "@/lib/telemetry";
import { logV2 } from "@/lib/telemetry-v2";
import { INDUSTRIES, SIZE_BANDS } from "@/lib/org-segments";
import { emitClientEvent } from "@/lib/client-telemetry";
import {
  loadToolsUsed,
  saveToolsUsed,
  toolCountBucket,
  type ToolId,
} from "@/lib/onboarding-tools";
import { orgTypeForChoice, type IntentParam, type OrgType } from "@/lib/org-type";
import { parseFunnelSource, type FunnelSource } from "@/lib/funnel-source";
import type { SignupSource } from "@/lib/edu-entry";
import {
  deriveRegister,
  REGISTER_COPY,
  REGISTER_SHARED_COPY,
  type EntryDoor,
} from "@/lib/register";


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
  // Pass O1: the type is what decides which product a person gets, so the
  // write is read back and tried once more rather than assumed.
  await supabase
    .from("orgs")
    .update({ settings: { ...settings, type } })
    .eq("id", profile.org_id);
  const { data: written } = await supabase
    .from("orgs")
    .select("settings")
    .eq("id", profile.org_id)
    .maybeSingle();
  const landed = (written?.settings ?? {}) as Record<string, unknown>;
  if (landed["type"] !== type) {
    await supabase
      .from("orgs")
      .update({ settings: { ...landed, type } })
      .eq("id", profile.org_id);
  }


  // Pass 185: the front door, written once at creation and never edited afterwards.
  const source = readSignupSource() ?? "direct";
  await supabase.from("orgs").update({ signup_source: source }).eq("id", profile.org_id);
  clearSignupSource();

  // V6: arriving from a partner front door no longer affiliates. An
  // affiliation is entitlement, and entitlement comes only from a redeemed
  // activation key. signup_source stays recorded above as attribution.
  return profile.org_id;
}

/** KX1: the carried-key notice on the name screen. Canonical copy lives in @/lib/key-notice. */
import { KEY_NOTICE_COPY, KeyNoticeSentence } from "@/lib/key-notice";
export { KEY_NOTICE_COPY, KeyNoticeSentence };

const REDEEM_FAILED_REASONS = [
  "not_found",
  "expired",
  "revoked",
  "exhausted",
  "domain_not_allowed",
  "needs_workspace",
] as const;

/** Unit 19: shown when the workspace was created but the key did not apply. */
export const KEY_KEPT_COPY = "Your workspace is ready. We could not apply the key yet, so it is still saved.";

/** Closed reason for activation.redeem_failed. Anything unlisted is "other". */
export function redeemFailedReason(reason: unknown): string {
  return typeof reason === "string" && (REDEEM_FAILED_REASONS as readonly string[]).includes(reason)
    ? reason
    : "other";
}

/**
 * TV5: whether the first-run tour still owes this person a showing. Only a
 * new workspace (never ?setup=1), and only until profiles.onboarding.welcome_seen
 * is set.
 */
export function firstRunTourPending(setup: boolean | undefined, profile: { onboarding: unknown } | null): boolean {
  if (setup || !profile) return false;
  return !readOnboardingUi(profile.onboarding).welcome_seen;
}

type OnboardingSearch = {
  intent?: IntentParam | undefined;
  setup?: boolean | undefined;
  key?: string | undefined;
  from?: SignupSource | undefined;
  src?: FunnelSource | undefined;
};

/**
 * Unit B5X: /plans is the door that sets the register. Someone who reaches
 * onboarding with no intent, no invite and no edu flag goes there to choose,
 * with from and src carried through untouched. Returns the /plans search, or
 * null when onboarding should continue.
 */
export function plansRedirectSearch(
  search: OnboardingSearch,
  hasEduFlag: boolean,
): { from?: SignupSource; src?: FunnelSource } | null {
  // intent=invite with no pending invite behind it (beforeLoad checks that
  // first) carries no register either, so it goes to /plans as well, where
  // the invite code entry lives.
  if (search.setup || hasEduFlag) return null;
  if (search.intent && search.intent !== "invite") return null;
  return {
    ...(search.from ? { from: search.from } : {}),
    ...(search.src ? { src: search.src } : {}),
  };
}

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): OnboardingSearch => {
    const intent = search["intent"];
    const from = search["from"];
    const src = parseFunnelSource(search["src"]);
    const setup = search["setup"] === true || search["setup"] === "1" ? { setup: true } : {};
    const key = cleanActivationKey(search["key"]);
    return {
      ...(key ? { key } : {}),
      ...(intent === "company" ||
      intent === "personal" ||
      intent === "edu" ||
      intent === "partner" ||
      intent === "invite"
        ? { intent }
        : {}),
      ...setup,
      // Carried through untouched; /plans applies its own closed vocabulary.
      ...(typeof from === "string" && from.length > 0 && from.length <= 64
        ? { from: from as SignupSource }
        : {}),
      ...(src ? { src } : {}),
    };
  },
  beforeLoad: async ({ search }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // Unit 19: a bounce to sign in keeps the invite it was carrying.
      throw redirect({
        to: "/auth",
        search: {
          ...(search.intent ? { intent: search.intent } : {}),
          ...(search.key ? { key: search.key } : {}),
        } as never,
      });
    }
    const profile = await fetchProfile();
    // `?setup=1` is how an existing member reopens the tool setup from Connectors.
    if (profile && !search.setup) throw redirect({ to: "/home" });
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
      const plans = plansRedirectSearch(search, readEduIntent());
      if (plans) throw redirect({ to: "/plans", search: plans, replace: true });
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
  const { intent, setup, key, from, src } = Route.useSearch();
  const redeemKey = useServerFn(redeemActivationKeyFn);
  const lookupKey = useServerFn(lookupActivationKeyFn);
  // KX1: the key this signup would redeem, shown before it is used. URL
  // first, then a saved key that has not expired. Only the setup stage.
  const [carriedKey, setCarriedKey] = useState<string | null>(() =>
    setup ? null : (key ?? readActivationKey()),
  );
  const [keyInstitution, setKeyInstitution] = useState<string | null>(null);
  // Unit C: the register comes from the door. Unit B5X: with no door signal
  // at all, beforeLoad sends the person to /plans to choose.
  const [derived] = useState(() => deriveRegister(intent));
  const [entryDoor] = useState<EntryDoor>(() =>
    intent === "company" || intent === "personal" || intent === "edu" || intent === "partner"
      ? "intent"
      : readEduIntent()
        ? "edu_flag"
        : intent === "invite"
          ? "invite"
          : "chooser",
  );
  const [stage, setStage] = useState<"setup" | "share_back" | "segment" | "tools" | "capture" | "tour">(setup ? "tools" : "setup");
  const [shareBack, setShareBack] = useState<{ id: string; name: string; orgId: string | null } | null>(null);
  const [shareBackPending, setShareBackPending] = useState(false);
  const [shareBackError, setShareBackError] = useState<string | null>(null);
  const [tools, setTools] = useState<Set<ToolId>>(new Set());
  const [orgType] = useState<OrgType>(orgTypeForChoice(derived));
  const [displayName, setDisplayName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // SEG-1a/1b: the optional segmentation step after creation. Organisations
  // answer Industry and People; an individual answers one question; edu skips.
  const [segmentOrgId, setSegmentOrgId] = useState<string | null>(null);
  const [segmentProfileId, setSegmentProfileId] = useState<string | null>(null);
  const [segIndustry, setSegIndustry] = useState("");
  const [segSizeBand, setSegSizeBand] = useState("");
  const [segUseFor, setSegUseFor] = useState("");
  const [segPending, setSegPending] = useState(false);

  /** Where the flow goes once a workspace exists: everyone but edu gets the optional segment step first. */
  function afterCreation(): "segment" | "tools" {
    return orgType === "edu" ? "tools" : "segment";
  }

  // KX1: name who the key belongs to without redeeming it. Never blocks.
  useEffect(() => {
    if (!carriedKey) return;
    let live = true;
    void lookupKey({ data: { code: carriedKey } })
      .then((r) => {
        if (live) setKeyInstitution(r?.ok && r.institution_name ? r.institution_name : null);
      })
      .catch(() => {
        if (live) setKeyInstitution(null);
      });
    return () => {
      live = false;
    };
  }, [carriedKey, lookupKey]);

  function removeKey() {
    emitClientEvent("activation.key_removed", { had_institution: keyInstitution !== null });
    clearActivationKey();
    setCarriedKey(null);
    setKeyInstitution(null);
    navigate({
      to: "/onboarding",
      search: (prev: OnboardingSearch) => {
        const { key: _drop, ...rest } = prev;
        return rest;
      },
      replace: true,
    } as never);
  }

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

    // Unit W: a fresh read of the caller's workspaces, straight from the
    // database and never from the query cache, before anything is created.
    // A stale cached identity once sent an existing member here and minted a
    // phantom workspace. Anyone who already has one goes to their work, and
    // anyone who cannot be checked is never given a new one.
    const { data: freshUser, error: freshUserError } = await supabase.auth.getUser();
    const freshRead =
      freshUserError || !freshUser.user
        ? null
        : await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", freshUser.user.id)
            .is("deactivated_at", null);
    if (!freshRead || freshRead.error || !freshRead.data) {
      setError("We could not check your account just now. Nothing was created. Please try again.");
      setPending(false);
      return;
    }
    if (freshRead.data.length > 0) {
      // Drop the cached identity so the gate on /work reads the real one.
      queryClient.removeQueries({ queryKey: AUTH_USER_KEY });
      queryClient.removeQueries({ queryKey: ["profiles"] });
      setPending(false);
      navigate({ to: "/work", replace: true });
      return;
    }

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
    let createdOrgId: string | null = null;
    if (profile) {
      const orgId = await applyOrgType(profile.id, orgType);
      createdOrgId = orgId ?? profile.org_id ?? null;
      if (orgId) {
        logEvent("org.created", orgId, {
          org_type: orgType,
          register: derived ?? "none",
          entry_door: derived ? entryDoor : entryDoor === "invite" ? "invite" : "chooser",
        });
      }
      clearEduIntent();
    }

    // Unit J1 / KX1: the key shown on this screen redeems once, here, the
    // first moment a workspace exists. Submitting with the notice on screen
    // is the consent; a removed key is null and nothing is redeemed. The
    // outcome never blocks onboarding, but a failure is recorded.
    if (carriedKey) {
      let failed: string | null = null;
      try {
        const result = await redeemKey({ data: { code: carriedKey } });
        if (!result?.ok) failed = redeemFailedReason(result?.reason);
      } catch {
        failed = "other";
      }
      // Unit 19: clear only on success; a failed key stays saved and says so.
      if (failed) {
        setError(KEY_KEPT_COPY);
        if (createdOrgId) logEvent("activation.redeem_failed", createdOrgId, { reason: failed });
      } else {
        clearActivationKey();
      }
    }

    // Narrowed on purpose: only the keys this step can have changed.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["profiles"] }),
      queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] }),
      queryClient.invalidateQueries({ queryKey: ["work-items"] }),
      queryClient.invalidateQueries({ queryKey: ["engagements"] }),
    ]);
    setPending(false);

    // Share back: the database decides whether to ask. Any failure or a
    // "no" from the prompt goes straight on; this never blocks onboarding.
    type SharePrompt = { ask?: boolean; institution_id?: string; institution_name?: string };
    let prompt: SharePrompt | null = null;
    try {
      const { data, error: promptError } = await supabase.rpc("share_back_prompt", {});
      if (!promptError) prompt = (data ?? null) as unknown as SharePrompt | null;
    } catch {
      prompt = null;
    }
    if (prompt?.ask && prompt.institution_id && prompt.institution_name) {
      setShareBack({ id: prompt.institution_id, name: prompt.institution_name, orgId: createdOrgId });
      setStage("share_back");
      return;
    }
    setSegmentOrgId(createdOrgId);
    setSegmentProfileId(profile?.id ?? null);
    setStage(afterCreation());
  }

  async function answerShareBack(yes: boolean) {
    if (!shareBack) return;
    setShareBackPending(true);
    setShareBackError(null);
    const { error: answerError } = yes
      ? await supabase.rpc("offer_share_back", { p_institution_id: shareBack.id })
      : await supabase.rpc("decline_share_back", { p_institution_id: shareBack.id });
    setShareBackPending(false);
    if (answerError) {
      setShareBackError(answerError.message);
      return;
    }
    if (shareBack.orgId) {
      if (yes) logEvent("share_back.offered", shareBack.orgId, {});
      else logEvent("share_back.declined", shareBack.orgId, {});
    }
    setSegmentOrgId(shareBack.orgId);
    setStage(afterCreation());
  }

  // SEG-1a/1b: optional, skippable, and only ever writes the fields the shape
  // it showed actually asked about. A failed save is silent; this step never
  // blocks the way in.
  async function saveSegment() {
    if (!segmentOrgId) {
      setStage("tools");
      return;
    }
    setSegPending(true);
    const isPersonal = orgType === "personal";
    const industry = segIndustry || null;
    const sizeBand = segSizeBand || null;
    const useFor = segUseFor || null;
    const payload = isPersonal
      ? { use_for: useFor }
      : { industry, size_band: sizeBand };
    const { error: saveError } = await supabase
      .from("orgs")
      .update(payload)
      .eq("id", segmentOrgId);
    setSegPending(false);
    if (!saveError) {
      const asked = isPersonal ? [useFor] : [industry, sizeBand];
      logV2(
        "organization.segment_updated",
        { fields_set: asked.filter((v) => Boolean(v)).length },
        { profileId: segmentProfileId ?? undefined },
      );
    }
    setStage("tools");
  }

  // TV5: the first-run tour sits in front of the existing completion path.
  // profiles.onboarding.welcome_seen is the memory that stops it replaying;
  // ?setup=1 is an existing member and never sees it.
  const [tourProfile, setTourProfile] = useState<Profile | null>(null);

  function land() {
    // Unit Y2: the same place sign-in lands, so the first visit and every
    // later one start on the same screen.
    navigate({ to: "/home", replace: true });
  }

  async function finish() {
    if (!setup) {
      const profile = await fetchProfile().catch(() => null);
      if (profile && firstRunTourPending(setup, profile)) {
        setTourProfile(profile);
        setStage("tour");
        return;
      }
    }
    land();
  }

  function completeTour() {
    const profile = tourProfile;
    if (profile) {
      // The same self update useOnboardingUi makes. Memory, so a failed write is silent.
      const next = { ...readOnboardingUi(profile.onboarding), welcome_seen: true };
      void (async () => {
        await supabase.from("profiles").update({ onboarding: next }).eq("id", profile.id);
        await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      })().catch(() => {
        /* onboarding memory never interrupts the person */
      });
    }
    land();
  }

  if (stage === "tour") {
    return (
      <main className="tour-preview-page" data-testid="onboarding-tour">
        <OnboardingTour
          register={tourProfile?.org_type ?? orgType}
          orgId={tourProfile?.org_id ?? null}
          onDone={completeTour}
        />
      </main>
    );
  }

  if (stage === "share_back" && shareBack) {
    return (
      <>
        <SessionHeader />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4 py-16">
          <div className="w-full max-w-md">
            <h1 className="page-title">{`${shareBack.name} sponsored your workspace`}</h1>
            <p className="mt-3 text-sm text-foreground">Do you want to share work with them?</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              You choose what you share, one piece at a time. They see nothing until you send it.
            </p>
            {shareBackError ? <p className="mt-3 text-sm text-destructive">{shareBackError}</p> : null}
            <div className="mt-6 flex flex-col items-start gap-3">
              <Button type="button" disabled={shareBackPending} onClick={() => void answerShareBack(true)}>
                {`Yes, share with ${shareBack.name}`}
              </Button>
              <Button type="button" variant="outline" disabled={shareBackPending} onClick={() => void answerShareBack(false)}>
                No thanks
              </Button>
              <p className="text-xs text-muted-foreground">We will not ask again.</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (stage === "segment") {
    return (
      <>
        <SessionHeader />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4 py-16">
          <div className="w-full max-w-md">
            <h1 className="page-title">One thing before you start.</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              It helps us compare like with like, never you with anyone.
            </p>

            <div className="mt-6 space-y-5">
              {orgType === "personal" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="seg-use-for" className="micro-label">
                    What is this for
                  </Label>
                  <Select value={segUseFor} onValueChange={setSegUseFor}>
                    <SelectTrigger id="seg-use-for">
                      <SelectValue placeholder="Not set" />
                    </SelectTrigger>
                    <SelectContent>
                      {USE_FOR_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="seg-industry" className="micro-label">
                      Industry
                    </Label>
                <Select value={segIndustry} onValueChange={setSegIndustry}>
                  <SelectTrigger id="seg-industry">
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seg-people" className="micro-label">
                  People
                </Label>
                <Select value={segSizeBand} onValueChange={setSegSizeBand}>
                  <SelectTrigger id="seg-people">
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_BANDS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
                </>
              )}
            </div>

            <div className="mt-8 flex items-center gap-6">
              <Button type="button" disabled={segPending} onClick={() => void saveSegment()}>
                Continue
              </Button>
              <button
                type="button"
                onClick={() => setStage("tools")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Skip
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
            <div>
              <StepRail current={0} />
            </div>
            <h1 className="page-title mt-2">Where do you work with AI?</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Pick everything you use. We'll only set up what you choose, and nothing comes in
              until you say so.
            </p>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

            <div className="mt-6">
              <ToolPicker selected={tools} onToggle={toggleTool} />
            </div>

            <div className="mt-8 flex items-center gap-6">
              <Button type="button" onClick={() => void continueFromTools()}>
                Continue
              </Button>
              <button
                type="button"
                onClick={() => void finish()}
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

  if (stage === "capture") {
    return (
      <>
        <SessionHeader />
        <main className="flex min-h-[calc(100vh-4rem)] justify-center bg-background px-4 py-16">
          <div className="w-full max-w-3xl">
            <div>
              <StepRail current={1} />
            </div>
            <h1 className="page-title mt-2">Set up your first work</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Start with one source. The rest is waiting for you in your workspace, on the
              getting started card.
            </p>

            <div className="mt-6">
              <SetupTools tools={[...tools]} {...(setup ? {} : { register: orgType })} />
            </div>

            <div className="mt-8 flex items-center gap-6">
              <Button type="button" onClick={() => void finish()}>
                Go to my work
              </Button>
              <button
                type="button"
                onClick={() => void finish()}
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


  const copy = REGISTER_COPY[orgType];

  return (
    <>
      <SessionHeader />
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4 py-16">
        <div className="w-full max-w-md">
          <div className="rounded-[var(--radius)] border border-border bg-card p-6 shadow-card">
            <p className="micro-label">{copy.microLabel}</p>
            <h1 className="page-title mt-2">{REGISTER_SHARED_COPY.setupTitle}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{copy.setupBody}</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="display-name" className="micro-label">
                  {REGISTER_SHARED_COPY.nameLabel}
                </Label>
                <Input
                  id="display-name"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={REGISTER_SHARED_COPY.namePlaceholder}
                />
              </div>

              {copy.workspaceField ? (
                <div className="space-y-1.5">
                  <Label htmlFor="org-name" className="micro-label">
                    {copy.workspaceLabel}
                  </Label>
                  <Input
                    id="org-name"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder={copy.workspacePlaceholder}
                  />
                </div>
              ) : null}

              {carriedKey ? (
                <div
                  data-testid="key-notice"
                  className="rounded-[var(--radius)] border border-dashed border-border px-4 py-3"
                >
                  <p className="font-hand text-[16px] leading-snug text-foreground">
                    <KeyNoticeSentence institution={keyInstitution} />
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">{KEY_NOTICE_COPY.body}</p>
                  <button
                    type="button"
                    onClick={removeKey}
                    className="nb-pencil-cta nb-pencil-cta--sm mt-3"
                  >
                    <span>{KEY_NOTICE_COPY.remove}</span>
                  </button>
                </div>
              ) : null}

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Setting up…" : REGISTER_SHARED_COPY.submit}
              </Button>
              <button
                type="button"
                onClick={() =>
                  navigate({
                    to: "/plans",
                    search: { ...(from ? { from } : {}), ...(src ? { src } : {}) },
                  })
                }
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
