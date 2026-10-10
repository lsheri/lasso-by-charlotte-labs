import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { EntryDoorLink } from "@/components/layout/EntryDoorLink";
import { rememberEntryDoor } from "@/lib/entry-door";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { checkSignupInvite } from "@/lib/invites.functions";
import { type SignupInviteCheck } from "@/lib/signup-invite";
import { markSignupSource, type SignupSource } from "@/lib/edu-entry";
import { isPartnerSlug } from "@/lib/partners";
import { cleanActivationKey, clearActivationKey, markActivationKey } from "@/lib/key-entry";
import { deriveRegister, NEUTRAL_COPY, REGISTER_COPY } from "@/lib/register";
import type { IntentParam } from "@/lib/org-type";
import { aliasSignupVisitor, emitClientEvent } from "@/lib/client-telemetry";
import { identifyPostHog } from "@/lib/posthog-client";
import { parseFunnelSource, type FunnelSource } from "@/lib/funnel-source";
import { EXISTING_ACCOUNT_INVITED, EXISTING_ACCOUNT_OPEN, isExistingAccountSignup } from "@/lib/signup-existing";
import { FORGOT_LINK } from "@/lib/password-reset";
import { isSendCooldown, SIGN_IN_LINK_COPY, signInLinkOptions } from "@/lib/sign-in-link";
import { fetchProfile } from "@/hooks/use-profile";
import { lookupActivationKeyFn, redeemActivationKeyFn } from "@/lib/activation-keys.functions";
import { logEvent } from "@/lib/telemetry";
import { consentTarget } from "@/lib/consent-return";
import { KEY_NOTICE_COPY, KeyNoticeSentence } from "@/routes/onboarding";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    next?: string | undefined;
    invite?: string | undefined;
    intent?: IntentParam | undefined;
    from?: SignupSource | undefined;
    src?: FunnelSource | undefined;
    key?: string | undefined;
  } => {
    const next = search["next"];
    const intent = search["intent"];
    const invite = search["invite"];
    const from = search["from"];
    const src = parseFunnelSource(search["src"]);
    const key = cleanActivationKey(search["key"]);
    return {
      ...(key ? { key } : {}),
      ...(isPartnerSlug(from) || from === "edu" || from === "direct" ? { from } : {}),
      ...(src ? { src } : {}),
      ...(typeof invite === "string" && invite ? { invite } : {}),
      ...(typeof next === "string" && next.startsWith("/") ? { next } : {}),
      ...(intent === "company" ||
      intent === "personal" ||
      intent === "edu" ||
      intent === "partner" ||
      intent === "invite"
        ? { intent }
        : {}),
    };
  },
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const consent = consentTarget(search.next);
    if (consent) throw redirect({ to: "/oauth/consent", search: consent, replace: true });
    const target = joinTarget(search.next);
    if (search.key || search.invite || target?.code) return;
    if (target) throw redirect({ to: "/join", search: target, replace: true });
    throw redirect({ to: "/home" });
  },
  head: () => ({
    meta: [
      { title: "Sign in | Lasso" },
      {
        name: "description",
        content:
          "Sign in to Lasso, where your AI conversations, files and decisions sit next to the work they produced.",
      },
      { property: "og:title", content: "Sign in | Lasso" },
      {
        property: "og:description",
        content:
          "Sign in to Lasso, where your AI conversations, files and decisions sit next to the work they produced.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Sign in | Lasso" },
      {
        name: "twitter:description",
        content:
          "Sign in to Lasso, where your AI conversations, files and decisions sit next to the work they produced.",
      },
    ],
  }),
  component: AuthPage,
});

/** The only deep link we preserve through sign-in is an invite. */
function joinTarget(next: string | undefined) {
  if (!next || !next.startsWith("/join")) return null;
  const query = new URLSearchParams(next.split("?")[1] ?? "");
  const code = query.get("code");
  const eng = query.get("eng");
  return {
    code: code ?? undefined,
    eng: eng ?? undefined,
  } as { code?: string | undefined; eng?: string | undefined };
}

/** Unit D6: one person, one identity. Auth user id only, and only on success. */
export function noteSignUpIdentity(result: {
  user: { id: string } | null | undefined;
  error: unknown;
}): void {
  if (result.error || !result.user?.id) return;
  // Unit D7: alias before identify, so the anonymous funnel joins the account.
  try {
    aliasSignupVisitor(result.user.id);
  } catch {
    /* never into the sign-up path */
  }
  identifyPostHog(result.user.id);
}

function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { next, intent, invite, from, src, key } = Route.useSearch();
  useEffect(() => {
    if (intent) emitClientEvent("signup.started", { intent, src: src ?? "direct" }, { stableVisitor: true });
  }, [intent, src]);
  useEffect(() => {
    if (src) rememberEntryDoor(src);
  }, [src]);
  // Pass 185: the front door someone came through, remembered until the
  // workspace is created. Nothing else about the page changes.
  useEffect(() => {
    markSignupSource(from);
  }, [from]);
  useEffect(() => {
    markActivationKey(key);
  }, [key]);
  const checkInvite = useServerFn(checkSignupInvite);
  const lookupKey = useServerFn(lookupActivationKeyFn);
  const redeemKey = useServerFn(redeemActivationKeyFn);
  // Unit C: the email field speaks the register; with no signal it implies
  // nothing at all, rather than reading as a company.
  const register = deriveRegister(intent);
  const emailCopy = register ? REGISTER_COPY[register] : NEUTRAL_COPY;
  // An invite can arrive as its own param or inside the join destination.
  const inviteCode = invite ?? joinTarget(next)?.code;
  // Arriving from an invite: the page should read as the next step of that
  // invitation, not as a generic sign in wall.
  const invited = Boolean(joinTarget(next));

  function goOn() {
    const consent = consentTarget(next);
    if (consent) {
      navigate({ to: "/oauth/consent", search: consent, replace: true });
      return;
    }
    const target = joinTarget(next) ?? (inviteCode ? { code: inviteCode } : null);
    if (target) navigate({ to: "/join", search: target, replace: true });
    else if (intent) navigate({ to: "/onboarding", search: { intent }, replace: true });
    else navigate({ to: "/home", replace: true });
  }

  const [mode, setMode] = useState<"signin" | "signup">(
    invited || inviteCode || key ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [resendPending, setResendPending] = useState(false);

  const { data: authUser } = useQuery({
    queryKey: ["auth-entry-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user ?? null,
  });
  const carriedEntry = Boolean(key || inviteCode);
  const alreadySignedIn = Boolean(authUser && carriedEntry);
  const { data: currentProfile } = useQuery({
    queryKey: ["auth-entry-profile", authUser?.id],
    queryFn: fetchProfile,
    enabled: alreadySignedIn,
  });

  const { data: inviteCheck } = useQuery({
    queryKey: ["signup-invite", inviteCode],
    enabled: Boolean(inviteCode),
    queryFn: (): Promise<SignupInviteCheck> =>
      checkInvite({ data: { code: inviteCode as string } }),
  });
  const { data: keyCheck } = useQuery({
    queryKey: ["auth-entry-key", key],
    enabled: Boolean(key),
    queryFn: () => lookupKey({ data: { code: key as string } }),
  });

  // An invite bound to one address fills it in and holds it, so the account
  // that gets created is the one the admin asked for.
  const lockedEmail = inviteCheck?.ok ? (inviteCheck.email ?? null) : null;
  useEffect(() => {
    if (lockedEmail) setEmail(lockedEmail);
  }, [lockedEmail]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => setResendSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  function continuationUrl() {
    const register = deriveRegister(intent);
    const basePath = register ? `/onboarding?intent=${register}` : "/onboarding";
    const onboardingPath = key
      ? `${basePath}${register ? "&" : "?"}key=${encodeURIComponent(key)}`
      : basePath;
    return next
      ? `${window.location.origin}${next}`
      : inviteCode
        ? `${window.location.origin}/join?code=${encodeURIComponent(inviteCode)}`
        : `${window.location.origin}${onboardingPath}`;
  }

  async function useCurrentAccount() {
    setPending(true);
    setError(null);
    if (key && currentProfile) {
      const outcome = await redeemKey({ data: { code: key, profile_id: currentProfile.id } });
      logEvent("activation_key.submitted", currentProfile.org_id, { reason: outcome.reason, from: "settings" });
      if (!outcome.ok) {
        setError(outcome.message);
        setPending(false);
        return;
      }
      clearActivationKey();
      navigate({ to: "/home", replace: true });
      return;
    }
    if (inviteCode) {
      const target = joinTarget(next) ?? { code: inviteCode };
      navigate({ to: "/join", search: target, replace: true });
      return;
    }
    navigate({ to: "/onboarding", search: { ...(intent ? { intent } : {}), ...(key ? { key } : {}) }, replace: true } as never);
  }

  async function signOutForNewAccount() {
    await supabase.auth.signOut();
    queryClient.removeQueries({ queryKey: ["auth-entry-user"] });
    queryClient.removeQueries({ queryKey: ["auth-entry-profile"] });
    navigate({
      to: "/auth",
      search: {
        ...(next ? { next } : {}),
        ...(invite ? { invite } : {}),
        ...(intent ? { intent } : {}),
        ...(from ? { from } : {}),
        ...(src ? { src } : {}),
        ...(key ? { key } : {}),
      },
      replace: true,
    } as never);
  }

  async function resendConfirmation() {
    if (!confirmedEmail || resendPending || resendSeconds > 0) return;
    setResendPending(true);
    setError(null);
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: confirmedEmail,
      options: { emailRedirectTo: continuationUrl() },
    });
    if (resendError) setError(resendError.message);
    else setResendSeconds(30);
    setResendPending(false);
  }

  const [linkPending, setLinkPending] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  async function sendSignInLink() {
    if (linkPending) return;
    if (!email) {
      setLinkNote(SIGN_IN_LINK_COPY.needEmail);
      return;
    }
    setLinkPending(true);
    setLinkNote(null);
    setError(null);
    // The raw query, not the validated one, so nothing is dropped on the way back.
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: signInLinkOptions(window.location.search),
    });
    const cooldown = isSendCooldown(otpError);
    // Any other outcome, including an unknown address, reads as sent.
    setLinkNote(cooldown ? SIGN_IN_LINK_COPY.alreadySent : null);
    setLinkSent(true);
    emitClientEvent("auth.sign_in_link", { outcome: cooldown ? "cooldown" : "sent" }, { stableVisitor: true });
    setLinkPending(false);
  }


  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) setError(signInError.message);
      else {
        // KX1: an existing account never inherits a key saved in this browser.
        // Unit 19: a key in this page's own link is not stale and is kept.
        if (!key) clearActivationKey();
        goOn();
      }
    } else {
      // With an invite code, the gate is checked again on the server at submit
      // time, with the typed address. Without one, this is an open signup.
      if (inviteCode) {
        const verdict = await checkInvite({ data: { code: inviteCode, email } });
        if (!verdict.ok) {
          setError(verdict.message);
          setPending(false);
          return;
        }
      }
      // Unit C: the derived register rides the confirmation link, so it
      // survives being opened on another device. No signal, nothing carried.
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        // Carry the destination through confirmation, so an invite is never
        // lost between the email link and the accept page, and an open signup
        // lands on workspace setup.
        options: {
          emailRedirectTo: continuationUrl(),
        },
      });

      if (isExistingAccountSignup(data, signUpError)) {
        setMode("signin");
        setPassword("");
        setMessage(inviteCode ? EXISTING_ACCOUNT_INVITED : EXISTING_ACCOUNT_OPEN);
        emitClientEvent("signup.existing_account", { via: inviteCode ? "invite" : "open" }, { stableVisitor: true });
        setPending(false);
        return;
      }
      noteSignUpIdentity({ user: data.user, error: signUpError });
      if (signUpError) setError(signUpError.message);
      else if (data.session) goOn();
      else setConfirmedEmail(email);
    }

    setPending(false);
  }

  const institution = inviteCheck?.ok ? inviteCheck.org_name : keyCheck?.ok ? keyCheck.institution_name : null;
  const addressedTo = inviteCheck?.ok ? inviteCheck.email : null;

  if (alreadySignedIn) {
    const workspaceName = currentProfile?.org_name ?? "your current account";
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
        <div className="w-full max-w-[420px]">
          <EntryDoorLink className="mb-4 inline-block transition-colors hover:text-foreground"><BrandLockup /></EntryDoorLink>
          <div className="rounded-[var(--radius)] border border-border bg-card p-8 shadow-card">
            <h1 className="page-title">You are already signed in</h1>
            <p className="mt-3 text-sm text-foreground">{authUser?.email}</p>
            {institution || addressedTo ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {institution ? `This invitation is from ${institution}.` : null}
                {institution && addressedTo ? " " : null}
                {addressedTo ? `It was sent to ${addressedTo}.` : null}
              </p>
            ) : null}
            {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
            <div className="mt-6 grid gap-3">
              <Button type="button" onClick={() => void useCurrentAccount()} disabled={pending}>
                Use this key on {workspaceName}
              </Button>
              <Button type="button" variant="outline" onClick={() => void signOutForNewAccount()}>
                Sign out and set this up as a new account
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (confirmedEmail) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
        <div className="w-full max-w-[420px]">
          <EntryDoorLink className="mb-4 inline-block transition-colors hover:text-foreground"><BrandLockup /></EntryDoorLink>
          <div className="rounded-[var(--radius)] border border-border bg-card p-8 shadow-card">
            <h1 className="page-title">Check your email</h1>
            <p className="mt-4 break-words text-sm font-medium text-foreground">{confirmedEmail}</p>
            <p className="mt-2 text-sm text-muted-foreground">The link signs you in and picks up where you left off.</p>
            {key ? (
              <div data-testid="key-notice" className="mt-5 rounded-[var(--radius)] border border-dashed border-border px-4 py-3">
                <p className="font-hand text-[16px] leading-snug text-foreground">
                  <KeyNoticeSentence institution={keyCheck?.ok ? keyCheck.institution_name : null} />
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">{KEY_NOTICE_COPY.body}</p>
              </div>
            ) : null}
            {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
            <Button
              type="button"
              className="mt-6 w-full"
              onClick={() => void resendConfirmation()}
              disabled={resendPending || resendSeconds > 0}
            >
              {resendPending ? "Sending" : resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend email"}
            </Button>
            <p className="mt-3 text-sm text-muted-foreground">No email after a minute? Check spam, or resend above.</p>
            <Button type="button" variant="ghost" className="mt-3 px-0" onClick={() => { setConfirmedEmail(null); setError(null); }}>
              Change the address
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-[420px]">
        <EntryDoorLink className="mb-4 inline-block transition-colors hover:text-foreground">
          <BrandLockup />
        </EntryDoorLink>

        <div className="rounded-[var(--radius)] border border-border bg-card p-8 shadow-card">
          <h1 className="page-title">
            {mode === "signin"
              ? "Sign in"
              : invited
                ? "Set up your account"
                : "Create account"}{" "}
            <em className="italic">to Lasso</em>
          </h1>
          {consentTarget(next) && mode === "signin" ? (
            <p className="mt-2 text-sm text-muted-foreground">Sign in to finish connecting your AI tool.</p>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {key ? (
              <div data-testid="key-notice" className="mt-5 rounded-[var(--radius)] border border-dashed border-border px-4 py-3">
                <p className="font-hand text-[16px] leading-snug text-foreground">
                  <KeyNoticeSentence institution={keyCheck?.ok ? keyCheck.institution_name : null} />
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">{KEY_NOTICE_COPY.body}</p>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="micro-label">
                {emailCopy.emailLabel}
              </Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder={emailCopy.emailPlaceholder}
                value={email}
                readOnly={mode === "signup" && Boolean(lockedEmail)}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-[var(--radius-control)] border-[var(--nb-pencil)]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="micro-label">
                PASSWORD
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-[var(--radius-control)] border-[var(--nb-pencil)]"
              />
            </div>

            {mode === "signup" && inviteCheck && !inviteCheck.ok ? (
              <p className="text-sm text-destructive">{inviteCheck.message}</p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-accent-deep">{message}</p> : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
            {mode === "signin" ? (
              <Link to="/reset-password" search={next ? { next } : {}} className="mt-2 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground">{FORGOT_LINK}</Link>
            ) : null}
            {mode === "signin" ? (
              <div data-testid="sign-in-link" className="border-t border-border pt-4">
                {linkSent ? (
                  <div>
                    <p className="text-sm font-medium text-foreground">{SIGN_IN_LINK_COPY.sentTitle}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{linkNote ?? SIGN_IN_LINK_COPY.sentBody}</p>
                    <button type="button" className="mt-2 text-sm text-muted-foreground transition-colors hover:text-foreground" onClick={() => { setLinkSent(false); setLinkNote(null); }}>
                      {SIGN_IN_LINK_COPY.back}
                    </button>
                  </div>
                ) : (
                  <>
                    <Button type="button" variant="outline" className="w-full" disabled={linkPending} onClick={() => void sendSignInLink()}>
                      {linkPending ? SIGN_IN_LINK_COPY.sending : SIGN_IN_LINK_COPY.control}
                    </Button>
                    {linkNote ? <p className="mt-2 text-sm text-muted-foreground">{linkNote}</p> : null}
                  </>
                )}
              </div>
            ) : null}
          </form>

          <button
            type="button"
            className="mt-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setMessage(null);
            }}
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/trust"
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Trust &amp; data
          </Link>
        </div>
      </div>
    </main>
  );
}
