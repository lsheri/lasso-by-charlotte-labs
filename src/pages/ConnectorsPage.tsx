import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { BrandLogo, brandForToolkit, type BrandKey } from "@/components/connectors/BrandLogo";
import { ConnectYourAiCard } from "@/components/connectors/ConnectYourAiCard";
import { ConnectorPicker, type PickerKind } from "@/components/connectors/ConnectorPicker";
import { GranolaKeyCard } from "@/components/connectors/GranolaKeyCard";
import { WisprCard } from "@/components/connectors/WisprCard";
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
  one_drive: "Your Microsoft files, browsed folder by folder.",
  sharepoint_graph: "Team sites and document libraries you can reach.",
  gmail: "Client threads and the decisions buried in them.",
  notion: "Working pages and notes from your workspace.",
  slack: "Channel conversations where the work gets negotiated.",
  granola_mcp: "Meeting notes and transcripts from your calls.",
  wispr: "Meetings, notes and transcripts from your calls. Read only.",
};

/** Which connectors open a picker, and which picker. */
const PICKER_KIND: Partial<Record<ConnectorToolkit, PickerKind>> = {
  googledrive: "googledrive",
  one_drive: "onedrive",
  sharepoint_graph: "sharepoint",
  granola_mcp: "granola",
  wispr: "wispr",
  gmail: "gmail",
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
        brand={brandForToolkit(toolkit)}
        name={TOOLKIT_LABELS[toolkit]}
        description={DESCRIPTIONS[toolkit]}
        account={account}
        busy={busy === toolkit}
        identity={connected ? <ConnectorIdentity toolkit={toolkit} /> : null}
        actions={
          connected ? (
            <div className="flex items-center gap-4">
              {PICKER_KIND[toolkit] ? (
                <ConnectorPicker
                  kind={PICKER_KIND[toolkit]!}
                  trigger={
                    <button
                      type="button"
                      className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
                    >
                      {toolkit === "granola_mcp"
                        ? "Browse meetings"
                        : toolkit === "gmail"
                          ? "Browse threads"
                          : "Browse files"}
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
            <Button
              type="button"
              size="sm"
              disabled={busy === toolkit}
              onClick={() => void handleConnect(toolkit)}
            >
              {busy === toolkit ? "Waiting…" : "Connect"}
            </Button>
          )
        }
      />
    );
  }

  const connectedCount = accounts
    ? Object.values(accounts).filter((a) => a?.status === "connected").length
    : 0;
  const totalCount = Object.keys(DESCRIPTIONS).length;
  const notConnectedCount = Math.max(totalCount - connectedCount, 0);
  const subtitle = `${connectedCount} connected · ${notConnectedCount} not · Lasso reads only what you point it at`;

  return (
    <div>
      <PageHeader title="Where work" italicWord="lives" subtitle={subtitle} />

      {error ? <p className="mb-6 text-sm text-destructive">{(error as Error).message}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <Category title="Connect your AI · MCP">
            <ConnectYourAiCard />
          </Category>

          <Category title="Documents & files">
            <div className="grid gap-3 sm:grid-cols-2">
              {card("googledrive")}
              {card("one_drive")}
              {card("sharepoint_graph")}
              {card("notion")}
            </div>
          </Category>

          <Category title="Email & messages">
            <div className="grid gap-3 sm:grid-cols-2">
              {card("gmail")}
              {card("slack")}
            </div>
          </Category>

          <Category title="Meetings">
            <div className="space-y-3">
              <GranolaKeyCard />
              <WisprCard />
              <TranscriptsCard
                connected={accounts?.["googledrive"]?.status === "connected"}
                busy={busy === "googledrive"}
                onConnect={() => void handleConnect("googledrive")}
              />
            </div>
          </Category>

          <Category title="Coming soon">
            <div className="grid gap-3 sm:grid-cols-2">
              {COMING_SOON.map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-[var(--radius-lg)] border border-border bg-card/50 px-4 py-3 opacity-60"
                >
                  <p className="text-[13px] text-muted-foreground">{name}</p>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    Coming soon
                  </span>
                </div>
              ))}
            </div>
          </Category>

          <div className="rounded-[var(--radius-lg)] border border-border bg-card px-4 py-4">
            <p className="text-[13px] text-foreground">
              No connector? Paste or upload always works.
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-4">
              <Link to="/work" className="text-xs font-medium text-accent-deep hover:opacity-70">
                Go to Work →
              </Link>
              <Link
                to="/onboarding"
                search={{ setup: true }}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Set up more tools
              </Link>
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          <ToneCard tone="record" label="WHAT LASSO READS" title="Only what you point it at.">
            <ul className="space-y-1">
              <li>The files you open in a connected tool</li>
              <li>The conversations you send</li>
              <li>The meetings you record</li>
              <li>The documents you map to an engagement</li>
            </ul>
          </ToneCard>

          <ToneCard tone="paper" label="WHAT LASSO NEVER READS" title="Everything else.">
            <ul className="space-y-1">
              <li>Anything in a tool you have not connected</li>
              <li>Anything you have not sent</li>
              <li>Your inbox</li>
              <li>Your drive at large</li>
            </ul>
            <p className="mt-2">
              Disconnecting stops the reading. It does not delete what is already on the record.
            </p>
          </ToneCard>
        </aside>
      </div>

      <p className="font-hand mt-6 text-[16px] text-green">
        connect one. see what lands. connect the rest later.
      </p>
    </div>
  );
}

/**
 * Call transcripts are not a second connection, they are the same Google
 * Drive connection, opened straight into a picker scoped to where recordings
 * usually live. Still picker-only, nothing auto-imports.
 */
function TranscriptsCard({
  connected,
  busy,
  onConnect,
}: {
  connected: boolean;
  busy: boolean;
  onConnect: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-card">
      <BrandLogo brand="googledrive" size={30} />
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-medium text-foreground">Call transcripts (Google Drive)</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Recordings and transcripts already in your Drive. Uses the same connection.
        </p>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {busy ? "Pending" : connected ? "Ready" : "Needs Google Drive"}
      </span>
      {connected ? (
        <ConnectorPicker
          kind="transcripts"
          trigger={
            <Button type="button" size="sm" variant="outline">
              Find transcripts
            </Button>
          }
        />
      ) : (
        <Button type="button" size="sm" disabled={busy} onClick={onConnect}>
          {busy ? "Waiting…" : "Connect Google Drive"}
        </Button>
      )}
    </div>
  );
}

function Category({
  title,
  hue,
  children,
}: {
  title: string;
  hue: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className="rounded-[var(--radius)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em]"
        style={{
          color: `var(${hue})`,
          background: `color-mix(in oklab, var(${hue}) 10%, transparent)`,
        }}
      >
        {title}
      </h2>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function ConnectorCard({
  brand,
  name,
  description,
  account,
  actions,
  busy,
  identity,
}: {
  brand: BrandKey;
  name: string;
  description: string;
  account: ConnectorAccount | undefined;
  actions: React.ReactNode;
  busy: boolean;
  identity?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-card">
      <BrandLogo brand={brand} size={30} />
      <div className="min-w-0 flex-1 basis-48">
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
