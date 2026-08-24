import { Link } from "@tanstack/react-router";

import { BrandLogo } from "@/components/connectors/BrandLogo";
import { Button } from "@/components/ui/button";
import { ConnectorPicker } from "@/components/connectors/ConnectorPicker";
import { useConnectorAccounts } from "@/hooks/use-connector-accounts";

/**
 * Call transcripts belong where the work is, not buried on a settings page.
 * Same flow as the Connectors tile, just reachable from Work.
 */
export function TranscriptsAction() {
  const { data: accounts } = useConnectorAccounts();
  const drive = accounts?.["googledrive"]?.status === "connected";
  if (!drive) {
    return (
      <Button type="button" variant="outline" asChild>
        <Link to="/connectors">Find call transcripts</Link>
      </Button>
    );
  }
  return (
    <ConnectorPicker
      kind="transcripts"
      trigger={
        <Button type="button" variant="outline" className="gap-2">
          <BrandLogo brand="granola" size={17} />
          Find call transcripts
        </Button>
      }
    />
  );
}
