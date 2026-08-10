import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Wordmark } from "@/components/layout/Wordmark";
import { PasteThreadDialog } from "@/components/work/PasteThreadDialog";
import { UploadFilesButton } from "@/components/work/UploadFilesButton";
import { ImportFlowDialog } from "@/components/work/import/ImportFlowDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VENDORS, VENDOR_ORDER } from "@/lib/import-vendors";
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
  const [stage, setStage] = useState<"setup" | "why" | "capture">("setup");
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
    setPending(false);
    setStage("why");
  }

  function finish() {
    navigate({ to: "/work", replace: true });
  }

  if (stage === "why") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
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
            <Button type="button" onClick={() => setStage("capture")}>
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
    );
  }

  if (stage === "capture") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
        <div className="w-full max-w-3xl">
          <Wordmark size="lg" />
          <p className="micro-label mt-6">Step two</p>
          <h1 className="page-title mt-2">Bring in your work</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Start with one source. You can add the rest any time.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => navigate({ to: "/connectors" })}
              className="rounded-[var(--radius)] border border-border bg-card p-4 text-left shadow-card transition-colors hover:border-accent"
            >
              <p className="text-sm font-medium text-foreground">Connect Google Drive</p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                Live connector
              </p>
            </button>

            {VENDOR_ORDER.map((id) => (
              <ImportFlowDialog
                key={id}
                initialVendor={id}
                trigger={
                  <button
                    type="button"
                    className="rounded-[var(--radius)] border border-border bg-card p-4 text-left shadow-card transition-colors hover:border-accent"
                  >
                    <p className="text-sm font-medium text-foreground">
                      Import {VENDORS[id].label} history
                    </p>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      {VENDORS[id].tierHint}
                    </p>
                  </button>
                }
              />
            ))}

            <PasteThreadDialog
              trigger={
                <button
                  type="button"
                  className="rounded-[var(--radius)] border border-border bg-card p-4 text-left shadow-card transition-colors hover:border-accent"
                >
                  <p className="text-sm font-medium text-foreground">Paste a conversation</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    Full fidelity
                  </p>
                </button>
              }
            />

            <div className="rounded-[var(--radius)] border border-border bg-card p-4 shadow-card">
              <p className="text-sm font-medium text-foreground">Upload files</p>
              <div className="mt-2">
                <UploadFilesButton />
              </div>
            </div>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Everything lands private. Nothing is visible to anyone until you map it.
          </p>

          <div className="mt-6 flex items-center gap-6">
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
        </div>
      </main>
    );
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
