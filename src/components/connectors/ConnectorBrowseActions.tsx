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
            <Button type="button" variant="outline">
              Browse Drive files
            </Button>
          }
        />
      ) : null}
      {gmail ? (
        <ConnectorPicker
          kind="gmail"
          trigger={
            <Button type="button" variant="outline">
              Browse Gmail
            </Button>
          }
        />
      ) : null}
      {granola ? (
        <ConnectorPicker
          kind="granola"
          trigger={
            <Button type="button" variant="outline">
              Browse meetings
            </Button>
          }
        />
      ) : null}
    </>
  );
}
