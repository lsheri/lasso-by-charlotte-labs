import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/connectors/BrandLogo";
import { ConnectorPicker } from "@/components/connectors/ConnectorPicker";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import {
  disconnectWispr,
  finishWisprConnect,
  getWisprStatus,
  startWisprConnect,
} from "@/lib/wispr.functions";

/**
 * Wispr Flow signs you in through your browser, so this card sends you to
 * Wispr and picks the answer back up when you land here again. Nothing is
 * pasted, because Wispr does not issue a key to paste.
 */
export function WisprCard() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const start = useServerFn(startWisprConnect);
  const finish = useServerFn(finishWisprConnect);
  const status = useServerFn(getWisprStatus);
  const disconnect = useServerFn(disconnectWispr);
  const [busy, setBusy] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["wispr-status", profile?.id],
    queryFn: () => status({ data: { profile_id: profile?.id } }),
    enabled: Boolean(profile?.id),
    staleTime: 30_000,
  });
  const connected = data?.status === "connected";

  // Coming back from Wispr's sign-in page, with the answer in the address bar.
  useEffect(() => {
    if (!profile?.id || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) return;
    window.history.replaceState({}, "", window.location.pathname);
    void (async () => {
      try {
        await finish({ data: { profile_id: profile.id, code, state } });
        await refetch();
        await queryClient.invalidateQueries({ queryKey: ["connector-accounts"] });
        toast.success("Wispr Flow connected");
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
  }, [profile?.id, finish, refetch, queryClient]);

  async function handleConnect() {
    setBusy(true);
    try {
      const result = await start({
        data: {
          profile_id: profile?.id,
          redirect_uri: `${window.location.origin}${window.location.pathname}`,
        },
      });
      window.location.href = result.redirect_url;
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      await disconnect({ data: { profile_id: profile?.id } });
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["connector-accounts"] });
      toast.success("Wispr Flow disconnected");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-4">
        <BrandLogo brand="wispr" size={30} />
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-[13px] font-medium text-foreground">Wispr Flow</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {busy ? "Pending" : connected ? "Connected" : "Not connected"}
          </p>
          <p className="mt-1 text-[11.5px] leading-[17px] text-muted-foreground">
            Meetings, notes and transcripts from your calls. Read only, so Lasso never writes
            anything back to Wispr.
          </p>
          {connected && data?.identity ? (
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Signed in as {data.identity}
            </p>
          ) : null}
        </div>
        {connected ? (
          <div className="flex items-center gap-4">
            <ConnectorPicker
              kind="wispr"
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
        ) : (
          <Button type="button" size="sm" disabled={busy} onClick={() => void handleConnect()}>
            {busy ? "Opening Wispr…" : "Connect"}
          </Button>
        )}
      </div>

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
        You sign in with your Wispr Flow account, there is no key to paste. Wispr&apos;s own limits
        apply: you need Notetaker access, it is not available on Wispr Enterprise accounts, and
        setup is Mac only.
      </p>
    </div>
  );
}
