import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/layout/Wordmark";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { next?: string } => {
    const next = search["next"];
    return typeof next === "string" && next.startsWith("/") ? { next } : {};
  },
  beforeLoadDeps: ({ search }: { search: { next?: string } }) => ({ next: search.next }),
  beforeLoad: async ({ deps }) => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect(deps.next ? { href: deps.next } : { to: "/overview" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — Lasso by Charlotte Labs" },
      { name: "description", content: "Sign in to Lasso, the coaching platform for consultancies." },
      { property: "og:title", content: "Sign in — Lasso" },
      { property: "og:description", content: "Sign in to Lasso, the coaching platform for consultancies." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
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
      else navigate({ to: "/overview", replace: true });
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (signUpError) setError(signUpError.message);
      else if (data.session) navigate({ to: "/overview", replace: true });
      else setMessage("Check your email to confirm your account.");
    }

    setPending(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-sm">
        <Wordmark size="lg" />

        <div className="mt-6 rounded-[var(--radius)] border border-border bg-card p-6 shadow-card">
          <p className="micro-label">{mode === "signin" ? "Sign in" : "Create account"}</p>
          <h1 className="mt-2 page-title">
            {mode === "signin" ? "Welcome back" : "Get started"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Coaching context for engagement managers.
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
      </div>
    </main>
  );
}