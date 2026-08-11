import { ConnectorPicker } from "@/components/connectors/ConnectorPicker";
import { useConnectorAccounts } from "@/hooks/use-connector-accounts";

/** Onboarding capture tile: browse straight away if Drive is already connected. */
export function ConnectorCaptureCard({ onConnect }: { onConnect: () => void }) {
  const { data: accounts } = useConnectorAccounts();
  const connected = accounts?.["googledrive"]?.status === "connected";
  const card = (
    <button
      type="button"
      onClick={connected ? undefined : onConnect}
      className="w-full rounded-[var(--radius)] border border-border bg-card p-4 text-left shadow-card transition-colors hover:border-accent"
    >
      <p className="text-sm font-medium text-foreground">
        {connected ? "Browse Google Drive" : "Connect Google Drive"}
      </p>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {connected ? "Pick only what you want" : "Live connector"}
      </p>
    </button>
  );
  return connected ? <ConnectorPicker kind="googledrive" trigger={card} /> : card;
}
