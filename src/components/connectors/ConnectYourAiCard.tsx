import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { BrandPair } from "@/components/connectors/BrandLogo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import {
  CONNECTION_LIMIT_ERROR,
  createConnection,
  listConnections,
  renameConnection,
  revealConnection,
  revokeConnection,
  type ConnectionRow,
} from "@/lib/mcp-connections.functions";
import {
  MCP_PUSH_PHRASE,
  MCP_SERVER_NAME,
  MCP_SETUP_STEPS,
  MCP_VENDORS,
  VENDOR_LABELS,
} from "@/lib/mcp-setup-steps";
import { logEvent } from "@/lib/telemetry";

/**
 * Sign-in connections arrive in the next unit. While this is false they are
 * filtered out of the list; flipping it is the whole switch.
 */
export const SHOW_SIGNIN_CONNECTIONS = false;

export const CONNECTIONS_KEY = ["mcp-connections"] as const;

export const AI_TOOLS_COPY = {
  heading: "AI tools",
  sub: "Connect Lasso to Claude, ChatGPT, Cursor or any tool that takes a custom connector.",
  olderName: "Older link",
  olderLine: "Made before 1 Oct, can't be shown again. Replace it to see the link.",
  replaced: "Your new link is ready. Paste it into your tool, then disconnect the older link.",
  nameLabel: "Name this connection",
  namePlaceholder: "Claude",
  nameHelper:
    "Name it after the tool you will paste it into, so you know which one to disconnect later.",
  create: "Create link",
  nameError: "Give the connection a name, up to 80 characters.",
  limitError: "You have 25 connections. Disconnect one first.",
  disconnectBody:
    "The tool using this link stops being able to add work right away. You can create a new one any time.",
} as const;

const SETUP_INSTRUCTIONS = MCP_VENDORS.map(
  (vendor) => `${VENDOR_LABELS[vendor]}:\n${MCP_SETUP_STEPS[vendor].join("\n")}`,
)
  .concat(`Then, in any conversation: "${MCP_PUSH_PHRASE}"`)
  .join("\n\n");

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(iso);
}

function validName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= 80;
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

async function copyText(value: string, label: string) {
  await navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
}

/**
 * The revealed link. Session replay masks all text through the PostHog
 * maskTextSelector "*", which covers this element and the Copy button.
 */
function RevealedLink({ secret, workspace }: { secret: string; workspace: string }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = `${origin}/api/mcp/${secret}`;
  return (
    <div className="mt-3 rounded-[var(--radius)] border border-accent bg-accent-soft px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <code
          data-testid="revealed-url"
          data-ph-no-autocapture
          className="ph-no-autocapture min-w-0 flex-1 break-all font-mono text-xs text-foreground"
        >
          {url}
        </code>
        <Button
          type="button"
          size="sm"
          data-testid="copy-url"
          data-ph-no-autocapture
          className="ph-no-autocapture"
          onClick={() => void copyText(url, "Link")}
        >
          Copy
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {`Anyone with this link can add work to ${workspace} as you. Keep it private.`}
      </p>
      <p data-ph-no-autocapture className="ph-no-autocapture mt-1 text-xs text-muted-foreground">
        {`The same key also works as a header. Send Authorization: Bearer ${secret} to ${origin}/api/mcp`}
      </p>
    </div>
  );
}

type RowProps = {
  row: ConnectionRow;
  workspace: string;
  orgId: string | undefined;
  fromReplace: boolean;
  onReplace: (row: ConnectionRow) => void;
  onChanged: () => Promise<void>;
};

export function ConnectionRowView({ row, workspace, orgId, fromReplace, onReplace, onChanged }: RowProps) {
  const reveal = useServerFn(revealConnection);
  const rename = useServerFn(renameConnection);
  const revoke = useServerFn(revokeConnection);
  const [secret, setSecret] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(row.label ?? "");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const name = row.older ? AI_TOOLS_COPY.olderName : row.label || AI_TOOLS_COPY.olderName;
  const isSignin = row.kind === "signin";
  const showReveal = !isSignin && !row.older && row.can_reveal;

  async function handleReveal() {
    setBusy(true);
    try {
      const { secret: value } = await reveal({ data: { id: row.id } });
      setSecret(value);
      if (value && orgId) logEvent("mcp.connection_revealed", orgId, { kind: row.kind });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRename() {
    if (!validName(draft)) {
      setRenameError(AI_TOOLS_COPY.nameError);
      return;
    }
    setBusy(true);
    try {
      await rename({ data: { id: row.id, label: draft.trim() } });
      setRenaming(false);
      setRenameError(null);
      await onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    setBusy(true);
    try {
      await revoke({ data: { id: row.id } });
      if (orgId) {
        logEvent("mcp.connection_revoked", orgId, {
          kind: row.kind,
          via: fromReplace ? "replace" : "settings",
        });
      }
      setConfirmOpen(false);
      await onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-[var(--radius)] border border-border bg-card px-4 py-3" data-testid="connection-row">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {renaming ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label={AI_TOOLS_COPY.nameLabel}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="rounded-[var(--radius)] border border-border bg-background px-2 py-1 text-[13px]"
            />
            <Button type="button" size="sm" disabled={busy} onClick={() => void handleRename()}>
              Save
            </Button>
            <button
              type="button"
              onClick={() => {
                setRenaming(false);
                setRenameError(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <p className="text-[13px] font-medium text-foreground">{name}</p>
            {!row.older ? (
              <button
                type="button"
                onClick={() => setRenaming(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Rename
              </button>
            ) : null}
          </>
        )}
      </div>
      {renameError ? <p className="mt-1 text-xs text-destructive">{renameError}</p> : null}

      {isSignin ? (
        <p className="mt-1 text-xs text-muted-foreground">{`Signed in from ${row.client_name ?? ""}`}</p>
      ) : row.key_last4 ? (
        <p className="mt-1 font-mono text-xs text-muted-foreground">{`····${row.key_last4}`}</p>
      ) : null}

      <p className="mt-1 text-xs text-muted-foreground">
        {row.last_used_at
          ? `Added ${formatDate(row.created_at)} · Last used ${relative(row.last_used_at)}`
          : `Added ${formatDate(row.created_at)} · Never used`}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{`Adds work to ${workspace}`}</p>
      {row.older ? <p className="mt-1 text-xs text-muted-foreground">{AI_TOOLS_COPY.olderLine}</p> : null}

      <div className="mt-2 flex flex-wrap items-center gap-4">
        {showReveal && !secret ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleReveal()}
            className="text-xs font-medium text-accent-deep hover:opacity-70"
          >
            Reveal
          </button>
        ) : null}
        {row.older ? (
          <button
            type="button"
            onClick={() => onReplace(row)}
            className="text-xs font-medium text-accent-deep hover:opacity-70"
          >
            Replace
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          Disconnect
        </button>
      </div>

      {secret ? <RevealedLink secret={secret} workspace={workspace} /> : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{`Disconnect ${name}?`}</AlertDialogTitle>
            <AlertDialogDescription>{AI_TOOLS_COPY.disconnectBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void handleRevoke();
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

export function ConnectYourAiCard() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const fetchList = useServerFn(listConnections);
  const create = useServerFn(createConnection);
  const { data: rows } = useQuery({
    queryKey: [...CONNECTIONS_KEY, profile?.id ?? null],
    queryFn: () => fetchList({ data: { profile_id: profile?.id } }),
  });
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ secret: string } | null>(null);
  const [replacedId, setReplacedId] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  const workspace = profile?.org_name ?? "";
  const visible = (rows ?? []).filter((row) => SHOW_SIGNIN_CONNECTIONS || row.kind !== "signin");
  const newest = visible[0] ?? null;
  const stepsOpen = !newest || showSetup;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
  }

  function openSteps() {
    setShowSetup(true);
    if (profile) {
      logEvent("connector.setup_opened", profile.org_id, {
        surface: "mcp",
        had_connector: Boolean(newest),
      });
    }
  }

  async function makeLink(label: string, replacing: string | null) {
    if (!validName(label)) {
      setFormError(AI_TOOLS_COPY.nameError);
      return;
    }
    setFormError(null);
    setBusy(true);
    try {
      const result = await create({ data: { profile_id: profile?.id, label: label.trim() } });
      setCreated({ secret: result.secret });
      setReplacedId(replacing);
      setName("");
      if (profile) logEvent("mcp.connection_created", profile.org_id, { kind: result.kind });
      await refresh();
    } catch (e) {
      const message = (e as Error).message;
      if (message === CONNECTION_LIMIT_ERROR) setFormError(AI_TOOLS_COPY.limitError);
      else if (message === "invalid_label") setFormError(AI_TOOLS_COPY.nameError);
      else toast.error(message);
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
            <h3 className="text-[13px] font-medium text-foreground">{AI_TOOLS_COPY.heading}</h3>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              {connectorStatusLine(newest)}
            </p>
          </div>
        </div>
        <p className="mt-1.5 max-w-2xl nb-type-small leading-[17px] text-muted-foreground">
          {AI_TOOLS_COPY.sub}
        </p>

        {visible.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {visible.map((row) => (
              <ConnectionRowView
                key={row.id}
                row={row}
                workspace={workspace}
                orgId={profile?.org_id}
                fromReplace={replacedId === row.id}
                onReplace={(r) => void makeLink(name, r.id)}
                onChanged={refresh}
              />
            ))}
          </ul>
        ) : null}

        {created ? (
          <div className="mt-4">
            {replacedId ? (
              <p className="text-xs text-foreground">{AI_TOOLS_COPY.replaced}</p>
            ) : null}
            <RevealedLink secret={created.secret} workspace={workspace} />
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          <label htmlFor="mcp-connection-name" className="block text-xs font-medium text-foreground">
            {AI_TOOLS_COPY.nameLabel}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="mcp-connection-name"
              value={name}
              placeholder={AI_TOOLS_COPY.namePlaceholder}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 rounded-[var(--radius)] border border-border bg-background px-3 py-1.5 text-[13px]"
            />
            <Button type="button" disabled={busy} onClick={() => void makeLink(name, null)}>
              {AI_TOOLS_COPY.create}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{AI_TOOLS_COPY.nameHelper}</p>
          {formError ? (
            <p role="alert" className="text-xs text-destructive">
              {formError}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
          <button
            type="button"
            onClick={() => void copyText(SETUP_INSTRUCTIONS, "Setup instructions")}
            className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
          >
            Copy setup instructions
          </button>
          {newest ? (
            <button
              type="button"
              onClick={() => (showSetup ? setShowSetup(false) : openSteps())}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {showSetup ? "Hide setup instructions" : "Setup instructions"}
            </button>
          ) : null}
        </div>
        {stepsOpen ? (
          <div className="mt-3">
            <SetupSteps />
          </div>
        ) : null}
      </div>
    </section>
  );
}
