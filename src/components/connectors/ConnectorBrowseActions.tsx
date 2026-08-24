import { BrandLogo } from "@/components/connectors/BrandLogo";
import { Button } from "@/components/ui/button";
import { ConnectorPicker } from "@/components/connectors/ConnectorPicker";
import { useConnectorAccounts } from "@/hooks/use-connector-accounts";

/** Browse buttons appear only for connections that are live right now. */
export function ConnectorBrowseActions() {
  const { data: accounts } = useConnectorAccounts();
  const drive = accounts?.["googledrive"]?.status === "connected";
  const gmail = accounts?.["gmail"]?.status === "connected";
  const granola = accounts?.["granola_mcp"]?.status === "connected";
  if (!drive && !gmail && !granola) return null;
  return (
    <>
      {drive ? (
        <ConnectorPicker
          kind="googledrive"
          trigger={
            <Button type="button" variant="outline" className="gap-2">
              <BrandLogo brand="googledrive" size={17} />
              Browse Drive files
            </Button>
          }
        />
      ) : null}
      {gmail ? (
        <ConnectorPicker
          kind="gmail"
          trigger={
            <Button type="button" variant="outline" className="gap-2">
              <BrandLogo brand="gmail" size={17} />
              Browse Gmail
            </Button>
          }
        />
      ) : null}
      {granola ? (
        <ConnectorPicker
          kind="granola"
          trigger={
            <Button type="button" variant="outline" className="gap-2">
              <BrandLogo brand="granola" size={17} />
              Browse meetings
            </Button>
          }
        />
      ) : null}
    </>
  );
}
