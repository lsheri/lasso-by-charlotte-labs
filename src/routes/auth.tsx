import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/layout/Wordmark";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { next?: string | undefined; intent?: "company" | "personal" | "invite" | undefined } => {
    const next = search["next"];
    const intent = search["intent"];
    return {
      ...(typeof next === "string" && next.startsWith("/") ? { next } : {}),
      ...(intent === "company" || intent === "personal" || intent === "invite" ? { intent } : {}),
    };
  },
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const target = joinTarget(search.next);
    if (target) throw redirect({ to: "/join", search: target, replace: true });
    throw redirect({ to: "/overview" });
  },
  head: () => ({
    meta: [
      { title: "Sign in | Lasso by Charlotte Labs" },
      {
        name: "description",
        content: "Sign in to Lasso, the coaching platform for consultancies.",
      },
      { property: "og:title", content: "Sign in | Lasso" },
      {
        property: "og:description",
        content: "Sign in to Lasso, the coaching platform for consultancies.",
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

function AuthPage() {
  const navigate = useNavigate();
  const { next, intent } = Route.useSearch();
  // Arriving from an invite: the page should read as the next step of that
  // invitation, not as a generic sign in wall.
  const invited = Boolean(joinTarget(next));

  function goOn() {
    const target = joinTarget(next);
    if (target) navigate({ to: "/join", search: target, replace: true });
    else if (intent) navigate({ to: "/onboarding", search: { intent }, replace: true });
    else navigate({ to: "/overview", replace: true });
  }

  const [mode, setMode] = useState<"signin" | "signup">(invited ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) setError(signInError.message);
      else goOn();
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        // Carry the destination through confirmation, so an invite is never
        // lost between the email link and the accept page.
        options: {
          emailRedirectTo: next
            ? `${window.location.origin}${next}`
            : window.location.origin,
        },
      });
      if (signUpError) setError(signUpError.message);
      else if (data.session) goOn();
      else setMessage("Check your email to confirm your account.");
    }

    setPending(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="mb-4 inline-block font-mono text-[11px] tracking-[0.24em] text-muted-foreground transition-colors hover:text-foreground"
        >
          LASSO
        </Link>
        <Wordmark size="lg" />

        <div className="mt-6 rounded-[var(--radius)] border border-border bg-card p-6 shadow-card">
          <p className="micro-label">
            {invited ? "Your invite" : mode === "signin" ? "Sign in" : "Create account"}
          </p>
          <h1 className="mt-2 page-title">
            {invited
              ? mode === "signup"
                ? "Set up your account"
                : "Sign in to accept"
              : mode === "signin"
                ? "Welcome back"
                : "Get started"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {invited
              ? "One step left. You will land straight back on your invite."
              : "Coaching context for engagement managers."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="micro-label">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="micro-label">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-accent-deep">{message}</p> : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
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
