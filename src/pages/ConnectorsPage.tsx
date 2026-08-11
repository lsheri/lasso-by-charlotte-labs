import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConnectYourAiCard } from "@/components/connectors/ConnectYourAiCard";
import { ConnectorPicker } from "@/components/connectors/ConnectorPicker";
import {
  statusLabel,
  useConnectorAccounts,
  TOOLKIT_LABELS,
  type ConnectorAccount,
} from "@/hooks/use-connector-accounts";
import { useProfile } from "@/hooks/use-profile";
import {
  disconnectConnector,
  getConnectionStatus,
  initiateConnection,
  getConnectorDetails,
} from "@/lib/connectors.functions";
import type { ConnectorToolkit } from "@/lib/connector-toolkits";
import { logEvent } from "@/lib/telemetry";

const DESCRIPTIONS: Record<ConnectorToolkit, string> = {
  googledrive: "Docs, decks and sheets you've touched recently.",
  gmail: "Client threads and the decisions buried in them.",
  notion: "Working pages and notes from your workspace.",
  slack: "Channel conversations where the work gets negotiated.",
  granola_mcp: "Meeting notes and transcripts from your calls.",
};

const COMING_SOON = ["Zoom", "Teams", "ChatGPT Enterprise"];

export function ConnectorsPage() {
  const { data: profile } = useProfile();
  const { data: accounts, error } = useConnectorAccounts();
  const queryClient = useQueryClient();
  const initiate = useServerFn(initiateConnection);
  const checkStatus = useServerFn(getConnectionStatus);
  const disconnect = useServerFn(disconnectConnector);
  const [busy, setBusy] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = null;
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["connector-accounts"] });
  }

  async function handleConnect(toolkit: ConnectorToolkit) {
    setBusy(toolkit);
    stopPolling();
    try {
      const { redirect_url } = await initiate({ data: { toolkit, profile_id: profile?.id } });
      await refresh();
      if (redirect_url) window.open(redirect_url, "_blank", "noopener");

      const started = Date.now();
      pollTimer.current = setInterval(() => {
        void (async () => {
          if (Date.now() - started > 120_000) {
            stopPolling();
            setBusy(null);
            return;
          }
          const result = await checkStatus({ data: { toolkit } }).catch(() => null);
          if (result?.status === "connected") {
            stopPolling();
            setBusy(null);
            await refresh();
            toast.success(`${TOOLKIT_LABELS[toolkit]} connected`);
            if (profile) {
              logEvent("connector.enabled", profile.org_id, {
                toolkit,
                auth_mode: "worker_oauth",
              });
            }
          }
        })();
      }, 3000);
    } catch (e) {
      setBusy(null);
      toast.error((e as Error).message);
    }
  }

  async function handleDisconnect(toolkit: ConnectorToolkit) {
    setBusy(toolkit);
    try {
      await disconnect({ data: { toolkit, profile_id: profile?.id } });
      await refresh();
      toast.success(`${TOOLKIT_LABELS[toolkit]} disconnected`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function card(toolkit: ConnectorToolkit) {
    const account = accounts?.[toolkit];
    const connected = account?.status === "connected";
    return (
      <ConnectorCard
        key={toolkit}
        name={TOOLKIT_LABELS[toolkit]}
        description={DESCRIPTIONS[toolkit]}
        account={account}
        busy={busy === toolkit}
        identity={connected ? <ConnectorIdentity toolkit={toolkit} /> : null}
        actions={
          connected ? (
            <div className="flex items-center gap-4">
              {toolkit === "googledrive" || toolkit === "granola_mcp" ? (
                <ConnectorPicker
                  kind={toolkit === "googledrive" ? "googledrive" : "granola"}
                  trigger={
                    <button
                      type="button"
                      className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
                    >
                      {toolkit === "googledrive" ? "Browse files" : "Browse meetings"}
                    </button>
                  }
                />
              ) : null}
              <button
                type="button"
                onClick={() => void handleDisconnect(toolkit)}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <Button type="button" size="sm" disabled={busy === toolkit} onClick={() => void handleConnect(toolkit)}>
              {busy === toolkit ? "Waiting…" : "Connect"}
            </Button>
          )
        }
      />
    );
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="page-title">Where work lives</h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
          Where the record comes from. Connect a tool once — new work lands in Work, unmapped and
          private by default.
        </p>
      </header>

      {error ? <p className="mb-6 text-sm text-destructive">{(error as Error).message}</p> : null}

      <div className="space-y-10">
        <ConnectYourAiCard />

        <section>
          <h2 className="micro-label">Documents &amp; email</h2>
          <div className="mt-3 space-y-2">
            {card("googledrive")}
            {card("gmail")}
            {card("notion")}
          </div>
        </section>

        <section>
          <h2 className="micro-label">Messages</h2>
          <div className="mt-3 space-y-2">{card("slack")}</div>
        </section>

        <section>
          <h2 className="micro-label">Meetings</h2>
          <div className="mt-3 space-y-2">{card("granola_mcp")}</div>
        </section>

        <section>
          <h2 className="micro-label">Coming soon</h2>
          <div className="mt-3 space-y-2">
            {COMING_SOON.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-card/50 px-4 py-3 opacity-60"
              >
                <p className="text-sm text-muted-foreground">{name}</p>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  Coming soon
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-[var(--radius)] border border-border bg-card px-4 py-4 shadow-card">
          <p className="text-sm text-foreground">No connector? Paste or upload always works.</p>
          <Link to="/work" className="mt-1 inline-block text-xs font-medium text-accent-deep hover:opacity-70">
            Go to Work →
          </Link>
        </div>
      </div>
    </div>
  );
}

function ConnectorCard({
  name,
  description,
  account,
  actions,
  busy,
  identity,
}: {
  name: string;
  description: string;
  account: ConnectorAccount | undefined;
  actions: React.ReactNode;
  busy: boolean;
  identity?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-card">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        {identity}
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {busy ? "Pending" : statusLabel(account)}
      </span>
      {actions}
    </div>
  );
}

/**
 * Which account is actually linked. Composio exposes identity for some
 * toolkits only; when it doesn't, the card falls back to the connection date
 * already shown in the status column.
 */
function ConnectorIdentity({ toolkit }: { toolkit: ConnectorToolkit }) {
  const { data: profile } = useProfile();
  const details = useServerFn(getConnectorDetails);
  const { data } = useQuery({
    queryKey: ["connector-details", toolkit, profile?.id],
    queryFn: () => details({ data: { toolkit, profile_id: profile?.id } }),
    staleTime: 60_000,
  });
  if (!data?.identity) return null;
  return (
    <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
      Connected as {data.identity}
    </p>
  );
}