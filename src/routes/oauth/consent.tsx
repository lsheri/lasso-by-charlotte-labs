import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { BrandLockup } from "@/components/layout/BrandLockup";
import { Button } from "@/components/ui/button";
import { fetchProfileState, ROLE_LABELS, useActiveProfileId, type Profile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { clientDisplayName, redirectHost } from "@/lib/mcp-client-kind";
import { AUTHORIZATION_ID_SHAPE, consentNext } from "@/lib/consent-return";
import { CONNECTION_LIMIT_ERROR, decideSignin } from "@/lib/mcp-connections.functions";

export const Route = createFileRoute("/oauth/consent")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { authorization_id?: string | undefined } => {
    const id = search["authorization_id"];
    return typeof id === "string" && AUTHORIZATION_ID_SHAPE.test(id) ? { authorization_id: id } : {};
  },
  head: () => ({
    meta: [{ title: "Connect an AI tool | Lasso" }, { name: "robots", content: "noindex" }],
  }),
  component: ConsentPage,
});

export const CONSENT_COPY = {
  loading: "Checking this request",
  readyTitle: (display: string | null) => (display ? `Connect ${display} to Lasso` : "Connect an AI tool to Lasso"),
  readyBody: (display: string | null) =>
    `${display ?? "This tool"} will be able to add work to the workspace you choose, and read the work in it. It acts as you.`,
  hostLine: (host: string) => `After you approve, you go back to ${host}.`,
  signedInAs: (email: string) => `Signed in as ${email}.`,
  differentAccount: "Use a different account",
  pickerLabel: "Add work to",
  disconnectLine: "You can disconnect this from Settings at any time. Disconnecting stops it adding work straight away.",
  approve: "Approve",
  deny: "Deny",
  missingTitle: "This link is incomplete",
  missingBody: "Go back to your AI tool and choose Connect again.",
  expiredTitle: "This request has expired",
  expiredBody: "It may have been used already. Go back to your AI tool and choose Connect again.",
  noWorkspaceTitle: "Set up Lasso first",
  noWorkspaceBody: (display: string | null) =>
    `You need a Lasso workspace before ${display ?? "this tool"} can add work to it. Set one up, then choose Connect again in ${display ?? "your AI tool"}.`,
  setUp: "Set up Lasso",
  cancel: "Cancel",
  limit: (display: string | null) =>
    `You have 25 connections. Disconnect one in Settings, then choose Connect again in ${display ?? "your AI tool"}.`,
  generic: "Something went wrong and nothing was connected. Try again.",
  returning: (display: string | null) => `Returning you to ${display ?? "your AI tool"}.`,
  denied: "Nothing was connected. You can close this window.",
} as const;

type Details = {
  authorization_id: string;
  redirect_uri?: string | null;
  client: { id: string; name?: string | null };
};

type View = "loading" | "missing" | "expired" | "returning" | "no_workspace" | "ready" | "denied";

function ConsentPage() {
  const navigate = useNavigate();
  const { authorization_id: id } = Route.useSearch();
  const activeId = useActiveProfileId();
  const decide = useServerFn(decideSignin);
  const [view, setView] = useState<View>("loading");
  const [details, setDetails] = useState<Details | null>(null);
  const [email, setEmail] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const activeRef = useRef(activeId);
  activeRef.current = activeId;

  useEffect(() => {
    let live = true;
    void (async () => {
      if (!id) {
        setView("missing");
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!live) return;
      if (!userData.user) {
        navigate({ to: "/auth", search: { next: consentNext(id) }, replace: true });
        return;
      }
      setEmail(userData.user.email ?? "");
      const { data, error: detailsError } = await supabase.auth.oauth.getAuthorizationDetails(id);
      if (!live) return;
      if (detailsError || !data) {
        setView("expired");
        return;
      }
      const answer = data as Partial<Details> & { redirect_url?: string };
      if (answer.redirect_url && !answer.authorization_id) {
        setView("returning");
        window.location.assign(answer.redirect_url);
        return;
      }
      setDetails(answer as Details);
      const state = await fetchProfileState();
      if (!live) return;
      if (state.profiles.length === 0) {
        if (state.hasDeactivated) {
          navigate({ to: "/no-access", replace: true });
          return;
        }
        setView("no_workspace");
        return;
      }
      setProfiles(state.profiles);
      const active = state.profiles.find((p) => p.id === activeRef.current);
      setSelected((active ?? state.profiles[0])!.id);
      setView("ready");
    })();
    return () => {
      live = false;
    };
  }, [id, navigate]);

  const name = details?.client.name ?? null;
  const redirectUri = details?.redirect_uri ?? null;
  const display = clientDisplayName(name, redirectUri);
  const host = redirectHost(redirectUri);

  async function approve() {
    if (!id || !details || !selected) return;
    setBusy(true);
    setError(null);
    try {
      await decide({
        data: {
          decision: "approve",
          profile_id: selected,
          client_id: details.client.id,
          client_name: details.client.name ?? null,
          redirect_uri: details.redirect_uri ?? null,
        },
      });
    } catch (e) {
      setError(e instanceof Error && e.message === CONNECTION_LIMIT_ERROR ? CONSENT_COPY.limit(display) : CONSENT_COPY.generic);
      setBusy(false);
      return;
    }
    const { data, error: approveError } = await supabase.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true });
    if (approveError || !data?.redirect_url) {
      setError(CONSENT_COPY.generic);
      setBusy(false);
      return;
    }
    setView("returning");
    window.location.assign(data.redirect_url);
  }

  async function deny() {
    if (!id) return;
    setBusy(true);
    if (details) {
      try {
        await decide({
          data: {
            decision: "deny",
            profile_id: view === "no_workspace" ? null : selected,
            client_id: details.client.id,
            client_name: details.client.name ?? null,
            redirect_uri: details.redirect_uri ?? null,
          },
        });
      } catch {
        /* a failed record never blocks a deny */
      }
    }
    const { data } = await supabase.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true });
    if (data?.redirect_url) {
      setView("returning");
      window.location.assign(data.redirect_url);
      return;
    }
    setView("denied");
    setBusy(false);
  }

  async function differentAccount() {
    if (!id) return;
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { next: consentNext(id) } });
  }

  const roleOf = (p: Profile) => ROLE_LABELS[p.role] ?? p.role;
  const roleClass = "block truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground";

  let body: React.ReactNode;
  if (view === "loading") body = <p className="text-sm text-muted-foreground">{CONSENT_COPY.loading}</p>;
  else if (view === "missing")
    body = (
      <>
        <h1 className="page-title">{CONSENT_COPY.missingTitle}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{CONSENT_COPY.missingBody}</p>
      </>
    );
  else if (view === "expired")
    body = (
      <>
        <h1 className="page-title">{CONSENT_COPY.expiredTitle}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{CONSENT_COPY.expiredBody}</p>
      </>
    );
  else if (view === "returning") body = <p className="text-sm text-muted-foreground">{CONSENT_COPY.returning(display)}</p>;
  else if (view === "denied") body = <p className="text-sm text-muted-foreground">{CONSENT_COPY.denied}</p>;
  else if (view === "no_workspace")
    body = (
      <>
        <h1 className="page-title">{CONSENT_COPY.noWorkspaceTitle}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{CONSENT_COPY.noWorkspaceBody(display)}</p>
        <div className="mt-6 flex gap-3">
          <Button type="button" disabled={busy} onClick={() => navigate({ to: "/onboarding" })}>
            {CONSENT_COPY.setUp}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void deny()}>
            {CONSENT_COPY.cancel}
          </Button>
        </div>
      </>
    );
  else
    body = (
      <>
        <h1 className="page-title">{CONSENT_COPY.readyTitle(display)}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{CONSENT_COPY.readyBody(display)}</p>
        {host ? <p className="mt-2 text-sm text-muted-foreground">{CONSENT_COPY.hostLine(host)}</p> : null}
        <p className="mt-2 text-sm text-muted-foreground">
          {CONSENT_COPY.signedInAs(email)}{" "}
          <button type="button" className="underline hover:text-foreground" onClick={() => void differentAccount()}>
            {CONSENT_COPY.differentAccount}
          </button>
        </p>
        {profiles.length > 1 ? (
          <fieldset className="mt-6">
            <legend className="micro-label">{CONSENT_COPY.pickerLabel}</legend>
            <div className="mt-2 space-y-2">
              {profiles.map((p) => (
                <label key={p.id} className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="workspace"
                    value={p.id}
                    checked={selected === p.id}
                    onChange={() => setSelected(p.id)}
                    className="mt-1"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{p.org_name}</span>
                    <span className={roleClass}>{roleOf(p)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <div className="mt-6">
            <p className="micro-label">{CONSENT_COPY.pickerLabel}</p>
            <span className="mt-2 block text-sm font-medium">{profiles[0]?.org_name}</span>
            {profiles[0] ? <span className={roleClass}>{roleOf(profiles[0])}</span> : null}
          </div>
        )}
        <p className="mt-4 text-sm text-muted-foreground">{CONSENT_COPY.disconnectLine}</p>
        {error ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex gap-3">
          <Button type="button" disabled={busy || !selected} onClick={() => void approve()}>
            {CONSENT_COPY.approve}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void deny()}>
            {CONSENT_COPY.deny}
          </Button>
        </div>
      </>
    );

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-[480px]">
        <div className="mb-4 inline-block">
          <BrandLockup />
        </div>
        <div
          className="ph-no-autocapture rounded-[var(--radius)] border border-border bg-card p-8 shadow-card"
          data-ph-no-autocapture=""
          data-testid="consent-card"
        >
          {body}
        </div>
      </div>
    </main>
  );
}
