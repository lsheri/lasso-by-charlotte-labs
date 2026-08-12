import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ConnectorPicker } from "@/components/connectors/ConnectorPicker";
import { GranolaKeyCard } from "@/components/connectors/GranolaKeyCard";
import { Button } from "@/components/ui/button";
import { useConnectorAccounts, TOOLKIT_LABELS } from "@/hooks/use-connector-accounts";
import { useProfile } from "@/hooks/use-profile";
import { getConnectionStatus, initiateConnection } from "@/lib/connectors.functions";
import { logEvent } from "@/lib/telemetry";
import { TOOLS, type ToolId } from "@/lib/onboarding-tools";
import { ToolBadge } from "./ToolBadge";

/**
 * Real OAuth in the first session. On success the folder-first picker opens
 * inline — the user picks files themselves. Nothing arrives unselected.
 */
type ConnectTool = Extract<ToolId, "googledrive" | "granola" | "transcripts">;

export function LiveConnectCard({ tool }: { tool: ConnectTool }) {
  // Granola authenticates with a pasted API key, so it gets its own card.
  if (tool === "granola") return <GranolaKeyCard />;
  return <OAuthConnectCard tool={tool} />;
}

function OAuthConnectCard({ tool }: { tool: ConnectTool }) {
  // Call transcripts reuse the same Google Drive connection — no second OAuth.
  const toolkit = tool === "granola" ? "granola_mcp" : "googledrive";
  const pickerKind = tool === "transcripts" ? "transcripts" : "googledrive";
  const meta = TOOLS[tool];
  const { data: profile } = useProfile();
  const { data: accounts } = useConnectorAccounts();
  const queryClient = useQueryClient();
  const initiate = useServerFn(initiateConnection);
  const checkStatus = useServerFn(getConnectionStatus);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const connected = accounts?.[toolkit]?.status === "connected";

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  async function connect() {
    setBusy(true);
    try {
      const { redirect_url } = await initiate({ data: { toolkit, profile_id: profile?.id } });
      if (redirect_url) window.open(redirect_url, "_blank", "noopener");
      const started = Date.now();
      timer.current = setInterval(() => {
        void (async () => {
          if (Date.now() - started > 120_000) {
            if (timer.current) clearInterval(timer.current);
            setBusy(false);
            return;
          }
          const result = await checkStatus({ data: { toolkit } }).catch(() => null);
          if (result?.status === "connected") {
            if (timer.current) clearInterval(timer.current);
            setBusy(false);
            await queryClient.invalidateQueries({ queryKey: ["connector-accounts"] });
            toast.success(`${TOOLKIT_LABELS[toolkit]} connected`);
            if (profile) {
              logEvent("connector.enabled", profile.org_id, { toolkit, auth_mode: "worker_oauth" });
            }
            setPickerOpen(true);
          }
        })();
      }, 3000);
    } catch (e) {
      setBusy(false);
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-5 py-5 shadow-card">
      <div className="flex items-start gap-3">
        <ToolBadge tool={tool} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{meta.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {tool === "transcripts"
              ? "Uses your Google Drive connection. Lasso looks where recordings usually live, then you tick the ones you want."
              : "Connect once, then browse your folders and tick only the files you want."}
          </p>
        </div>
      </div>

      {!connected ? (
        <div className="mt-4">
          <Button type="button" disabled={busy} onClick={() => void connect()}>
            {busy
              ? "Waiting for you to approve…"
              : tool === "transcripts"
                ? "Connect Google Drive"
                : `Connect ${meta.label}`}
          </Button>
        </div>
      ) : (
        <div className="mt-4">
          <ConnectorPicker
            kind={pickerKind}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            trigger={
              <Button type="button">
                {tool === "transcripts" ? "Find call transcripts" : "Pick files to bring in"}
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
