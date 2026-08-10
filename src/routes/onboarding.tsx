import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Wordmark } from "@/components/layout/Wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const profile = await fetchProfile();
    if (profile) throw redirect({ to: "/work" });
  },
  head: () => ({
    meta: [
      { title: "Set up your workspace — Lasso" },
      { name: "description", content: "Create a Lasso workspace or join your team with an invite code." },
      { property: "og:title", content: "Set up your workspace — Lasso" },
      { property: "og:description", content: "Create a Lasso workspace or join your team with an invite code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [displayName, setDisplayName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { error: rpcError } =
      mode === "create"
        ? await supabase.rpc("create_org_with_profile", {
            p_display_name: displayName.trim(),
            p_org_name: orgName.trim(),
          })
        : await supabase.rpc("join_org_with_invite", {
            p_display_name: displayName.trim(),
            p_code: code.trim(),
          });

    if (rpcError) {
      setError(rpcError.message);
      setPending(false);
      return;
    }

    await queryClient.invalidateQueries();
    navigate({ to: "/work", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md">
        <Wordmark size="lg" />

        <div className="mt-6 rounded-[var(--radius)] border border-border bg-card p-6 shadow-card">
          <p className="micro-label">Welcome</p>
          <h1 className="page-title mt-2">Set up your workspace</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Two details and you're in. You can change them later.
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

            <div className="flex gap-1 rounded-[var(--radius)] bg-secondary p-1">
              {(
                [
                  ["create", "Create a workspace"],
                  ["join", "Join with an invite"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode(value);
                    setError(null);
                  }}
                  className={
                    mode === value
                      ? "flex-1 rounded-[calc(var(--radius)-4px)] bg-card px-3 py-2 text-sm font-medium text-foreground shadow-card"
                      : "flex-1 rounded-[calc(var(--radius)-4px)] px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "create" ? (
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
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="invite-code" className="micro-label">
                  Invite code
                </Label>
                <Input
                  id="invite-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="a1b2c3d4e5f6"
                  className="font-mono"
                />
              </div>
            )}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Setting up…" : mode === "create" ? "Create workspace" : "Join workspace"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
