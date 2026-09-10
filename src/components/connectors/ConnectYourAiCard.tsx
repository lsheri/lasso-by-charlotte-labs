import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { BrandPair } from "@/components/connectors/BrandLogo";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { createMcpToken, getMcpToken, revokeMcpToken } from "@/lib/mcp-tokens.functions";
import {
  MCP_PUSH_PHRASE,
  MCP_REGENERATE_WARNING,
  MCP_SERVER_NAME,
  MCP_SETUP_STEPS,
  MCP_VENDORS,
  VENDOR_LABELS,
} from "@/lib/mcp-setup-steps";
import { logEvent } from "@/lib/telemetry";

const SETUP_INSTRUCTIONS = MCP_VENDORS.map(
  (vendor) => `${VENDOR_LABELS[vendor]}:\n${MCP_SETUP_STEPS[vendor].join("\n")}`,
)
  .concat(`Then, in any conversation: "${MCP_PUSH_PHRASE}"`)
  .join("\n\n");

function formatDate(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Plain words for what is true right now, never a masked stand in for a URL. */
export function connectorStatusLine(
  token: { created_at: string; last_used_at: string | null } | null | undefined,
): string {
  if (!token) return "No connector yet";
  return token.last_used_at ? "Your connector is live" : "Set up, no work pushed yet";
}

export function SetupSteps() {
  return (
    <div className="space-y-4 rounded-[var(--radius)] border border-border bg-secondary/60 px-4 py-4">
      {MCP_VENDORS.map((vendor) => (
        <div key={vendor}>
          <p className="micro-label">{VENDOR_LABELS[vendor]}</p>
          <ol className="mt-1.5 space-y-1.5">
            {MCP_SETUP_STEPS[vendor].map((step, index) => (
              <li key={step} className="flex gap-2 text-sm text-muted-foreground">
                <span className="font-mono text-[11px] text-accent-deep">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
      <p className="text-sm text-muted-foreground">
        The server shows up in your AI as <span className="text-foreground">{MCP_SERVER_NAME}</span>
        .
      </p>
      <p className="text-sm text-muted-foreground">
        Then, at the end of any session, say “{MCP_PUSH_PHRASE}”
      </p>
    </div>
  );
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
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  // With no live connector the steps are the point of the card, so they are
  // open. Once one exists they sit behind the toggle, still one click away.
  const stepsOpen = !token || showSetup;

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  }

  function openSteps() {
    setShowSetup(true);
    if (profile) {
      logEvent("connector.setup_opened", profile.org_id, {
        surface: "connectors",
        had_connector: Boolean(token),
      });
    }
  }

  async function handleGenerate() {
    setBusy(true);
    try {
      const { token: raw } = await create({ data: { profile_id: profile?.id } });
      setFreshUrl(`${window.location.origin}/api/mcp/${raw}`);
      await queryClient.invalidateQueries({ queryKey: ["mcp-token"] });
      setShowSetup(true);
      setConfirming(false);
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

  return (
    <section id="connect-your-ai" className="scroll-mt-8">
      <div className="rounded-[var(--radius-lg)] border border-border bg-card px-4 py-3.5">
        <div className="flex items-center gap-3">
          <BrandPair brands={["claude", "chatgpt"]} size={26} />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground">
              Let Claude or ChatGPT push work straight into Lasso
            </p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              {connectorStatusLine(token)}
            </p>
          </div>
        </div>
        <p className="mt-1.5 max-w-2xl text-[11.5px] leading-[17px] text-muted-foreground">
          Add Lasso as a custom connector in your AI once. Then, at the end of any working session,
          just say “push this conversation to Lasso.” Everything lands private and unmapped, only
          you can see it.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          
          {token ? (
            <>
              <span className="text-xs text-muted-foreground">
                Created {formatDate(token.created_at)}
              </span>
              <span className="text-xs text-muted-foreground">
                Last used {formatDate(token.last_used_at)}
              </span>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => void copy(SETUP_INSTRUCTIONS, "Setup instructions")}
            className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
          >
            Copy setup instructions
          </button>
          {token ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRevoke()}
              className="text-xs text-muted-foreground transition-colors hover:text-destructive"
            >
              Revoke
            </button>
          ) : null}
        </div>

        {freshUrl ? (
          <div className="mt-4 rounded-[var(--radius)] border border-accent bg-accent-soft px-4 py-3">
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

        <div className="mt-4 space-y-2">
          <p className="text-xs text-muted-foreground">
            We keep your URL as a one way hash, so it can never be shown to you a second time. If
            you no longer have it, issue a new one.
          </p>
          {token && !confirming ? (
            <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
              Generate a new URL
            </Button>
          ) : null}
          {token && confirming ? (
            <div className="rounded-[var(--radius)] border border-border bg-secondary/60 px-4 py-3">
              <p className="text-sm text-muted-foreground">{MCP_REGENERATE_WARNING}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button type="button" disabled={busy} onClick={() => void handleGenerate()}>
                  {busy ? "Generating…" : "Yes, generate a new URL"}
                </Button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Keep the one I have
                </button>
              </div>
            </div>
          ) : null}
          {!token ? (
            <Button type="button" disabled={busy} onClick={() => void handleGenerate()}>
              {busy ? "Generating…" : "Generate my connector URL"}
            </Button>
          ) : null}
        </div>

        <div className="mt-5 space-y-3">
          {token ? (
            <button
              type="button"
              onClick={() => (showSetup ? setShowSetup(false) : openSteps())}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {showSetup ? "Hide setup instructions" : "Setup instructions"}
            </button>
          ) : null}
          {stepsOpen ? <SetupSteps /> : null}
        </div>
      </div>
    </section>
  );
}
