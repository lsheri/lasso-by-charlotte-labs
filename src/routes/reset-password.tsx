import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { EntryDoorLink } from "@/components/layout/EntryDoorLink";
import { supabase } from "@/integrations/supabase/client";
import { emitClientEvent } from "@/lib/client-telemetry";
import {
  afterResetDestination,
  RESET_BODY,
  RESET_BUTTON,
  RESET_SENT,
  RESET_TITLE,
  resetRedirectTo,
  SET_BUTTON,
  SET_TITLE,
} from "@/lib/password-reset";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { next?: string | undefined } => {
    const next = search["next"];
    return typeof next === "string" ? { next } : {};
  },
  head: () => ({
    meta: [
      { title: "Reset your password | Lasso by Charlotte Labs" },
      { name: "description", content: "Set a new password for your Lasso account." },
      { property: "og:title", content: "Reset your password | Lasso" },
      { property: "og:description", content: "Set a new password for your Lasso account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function isNetworkOrRate(error: { message?: string | undefined; status?: number | undefined } | null): boolean {
  if (!error) return false;
  if (error.status === 429) return true;
  const m = (error.message ?? "").toLowerCase();
  return m.includes("rate") || m.includes("fetch") || m.includes("network");
}

function ResetPasswordPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"request" | "set">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (alive && data.session) setMode("set");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setMode("set");
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    emitClientEvent("auth.password_reset", { step: "requested" }, { stableVisitor: true });
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetRedirectTo(window.location.origin, next),
      });
      if (isNetworkOrRate(err)) setError(err?.message ?? "Please try again.");
      else setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    emitClientEvent("auth.password_reset", { step: "completed" }, { stableVisitor: true });
    void navigate({ href: afterResetDestination(next), replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-[420px]">
        <EntryDoorLink className="mb-4 inline-block transition-colors hover:text-foreground">
          <BrandLockup />
        </EntryDoorLink>
        <div className="rounded-[var(--radius)] border border-border bg-card p-8 shadow-card">
          <h1 className="page-title">{mode === "set" ? SET_TITLE : RESET_TITLE}</h1>
          {mode === "set" ? (
            <form onSubmit={savePassword} className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="micro-label">PASSWORD</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-[var(--radius-control)] border-[var(--nb-pencil)]"
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={pending}>{SET_BUTTON}</Button>
            </form>
          ) : (
            <>
              <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">{RESET_BODY}</p>
              {sent ? (
                <p className="mt-8 text-sm text-accent-deep">{RESET_SENT}</p>
              ) : (
                <form onSubmit={requestLink} className="mt-8 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="micro-label">EMAIL</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="rounded-[var(--radius-control)] border-[var(--nb-pencil)]"
                    />
                  </div>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                  <Button type="submit" className="w-full" disabled={pending}>{RESET_BUTTON}</Button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
