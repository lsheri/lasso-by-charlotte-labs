import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { createMcpToken, getMcpToken, revokeMcpToken } from "@/lib/mcp-tokens.functions";

const SETUP_INSTRUCTIONS = `In Claude: Settings → Connectors → Add custom connector → paste your Lasso URL.
In ChatGPT: Settings → Connectors (or Developer mode) → Add → paste the URL.
Then, in any conversation: "Push this conversation to Lasso" or "Save these files to Lasso."`;

function formatDate(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ConnectYourAiCard() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const fetchToken = useServerFn(getMcpToken);
  const create = useServerFn(createMcpToken);
  const revoke = useServerFn(revokeMcpToken);
  const { data: token } = useQuery({
    queryKey: ["mcp-token"],
    queryFn: () => fetchToken({ data: { profile_id: profile?.id } }),
  });
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [busy, setBusy] = useState(false);

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  }

  async function handleGenerate() {
    setBusy(true);
    try {
      const { token: raw } = await create({ data: { profile_id: profile?.id } });
      setFreshUrl(`${window.location.origin}/api/mcp/${raw}`);
      await queryClient.invalidateQueries({ queryKey: ["mcp-token"] });
      setShowSetup(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    setBusy(true);
    try {
      await revoke({ data: { profile_id: profile?.id } });
      setFreshUrl(null);
      await queryClient.invalidateQueries({ queryKey: ["mcp-token"] });
      toast.success("Connector revoked");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const masked = freshUrl ? `…${freshUrl.slice(-6)}` : "…••••••";

  return (
    <section id="connect-your-ai" className="scroll-mt-8">
      <h2 className="micro-label">Connect your AI · MCP</h2>
      <div className="mt-3 rounded-[var(--radius)] border border-border bg-card px-5 py-5 shadow-card">
        <p className="text-sm font-medium text-foreground">
          Let Claude or ChatGPT push work straight into Lasso
        </p>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Add Lasso as a custom connector in your AI once. Then, at the end of any working session,
          just say “push this conversation to Lasso.” Everything lands private and unmapped, only
          you can see it.
        </p>

        {!token ? (
          <div className="mt-5">
            <Button type="button" disabled={busy} onClick={() => void handleGenerate()}>
              {busy ? "Generating…" : "Generate my connector URL"}
            </Button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {freshUrl ? (
              <div className="rounded-[var(--radius)] border border-accent bg-accent-soft px-4 py-3">
                <p className="micro-label text-accent-deep">Your connector URL, shown once</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <code className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">
                    {freshUrl}
                  </code>
                  <Button type="button" size="sm" onClick={() => void copy(freshUrl, "URL")}>
                    Copy
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  This URL is a key to your workspace. Treat it like a password. You can revoke it
                  anytime.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="font-mono text-xs text-muted-foreground">{masked}</span>
              <span className="text-xs text-muted-foreground">
                Created {formatDate(token.created_at)}
              </span>
              <span className="text-xs text-muted-foreground">
                Last used {formatDate(token.last_used_at)}
              </span>
              <button
                type="button"
                onClick={() => void copy(SETUP_INSTRUCTIONS, "Setup instructions")}
                className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
              >
                Copy setup instructions
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRevoke()}
                className="text-xs text-muted-foreground transition-colors hover:text-destructive"
              >
                Revoke
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowSetup((v) => !v)}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {showSetup ? "Hide setup instructions" : "Setup instructions"}
            </button>
            {showSetup ? (
              <div className="rounded-[var(--radius)] border border-border bg-secondary/60 px-4 py-3">
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {SETUP_INSTRUCTIONS}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
