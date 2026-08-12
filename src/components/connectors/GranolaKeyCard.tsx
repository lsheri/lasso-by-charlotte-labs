import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { ConnectorPicker } from "@/components/connectors/ConnectorPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConnectorAccounts, statusLabel } from "@/hooks/use-connector-accounts";
import { useProfile } from "@/hooks/use-profile";
import { disconnectConnector, getGranolaKeyMask, saveGranolaKey } from "@/lib/connectors.functions";

/**
 * Granola authenticates with a personal API key rather than OAuth, so the card
 * takes the key, hands it straight to the server for validation, and only ever
 * shows a mask afterwards.
 */
export function GranolaKeyCard() {
  const { data: profile } = useProfile();
  const { data: accounts } = useConnectorAccounts();
  const queryClient = useQueryClient();
  const save = useServerFn(saveGranolaKey);
  const disconnect = useServerFn(disconnectConnector);
  const mask = useServerFn(getGranolaKeyMask);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  const account = accounts?.["granola_mcp"];
  const connected = account?.status === "connected";

  const { data: masked } = useQuery({
    queryKey: ["granola-mask", profile?.id, connected],
    queryFn: () => mask({ data: { profile_id: profile?.id } }),
    enabled: connected,
    staleTime: 60_000,
  });

  async function handleSave() {
    setBusy(true);
    try {
      await save({ data: { api_key: key.trim(), profile_id: profile?.id } });
      setKey("");
      await queryClient.invalidateQueries({ queryKey: ["connector-accounts"] });
      toast.success("Granola connected");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      await disconnect({ data: { toolkit: "granola_mcp", profile_id: profile?.id } });
      await queryClient.invalidateQueries({ queryKey: ["connector-accounts"] });
      toast.success("Granola disconnected");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-card">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Granola</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Meeting notes and transcripts from your calls.
          </p>
          {connected && masked?.masked ? (
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Key {masked.masked}
            </p>
          ) : null}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {busy ? "Pending" : statusLabel(account)}
        </span>
        {connected ? (
          <div className="flex items-center gap-4">
            <ConnectorPicker
              kind="granola"
              trigger={
                <button
                  type="button"
                  className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
                >
                  Browse meetings
                </button>
              }
            />
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Disconnect
            </button>
          </div>
        ) : null}
      </div>

      {connected ? null : (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            Granola&apos;s API is available on their Business plan. Create a key in Granola →
            Settings → Connectors → API keys, then paste it here. We store it encrypted server-side
            and never show it again.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Granola API key"
              className="h-8 max-w-xs text-sm"
              autoComplete="off"
            />
            <Button
              type="button"
              size="sm"
              disabled={busy || !key.trim()}
              onClick={() => void handleSave()}
            >
              {busy ? "Checking…" : "Save key"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
