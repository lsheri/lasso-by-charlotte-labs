import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { ConnectorToolkit } from "@/lib/connector-toolkits";

export type ConnectorAccount = {
  toolkit: string;
  status: string;
  connected_at: string | null;
};

export function useConnectorAccounts() {
  return useQuery({
    queryKey: ["connector-accounts"],
    queryFn: async (): Promise<Record<string, ConnectorAccount>> => {
      const { data, error } = await supabase
        .from("connector_accounts")
        .select("toolkit, status, connected_at");
      if (error) throw error;
      const map: Record<string, ConnectorAccount> = {};
      for (const row of data ?? []) map[row.toolkit] = row;
      return map;
    },
  });
}

export function statusLabel(account: ConnectorAccount | undefined): string {
  if (!account || account.status === "not_connected" || account.status === "disconnected") {
    return "Not connected";
  }
  if (account.status === "pending") return "Pending";
  const date = account.connected_at
    ? new Date(account.connected_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;
  return date ? `Connected · ${date}` : "Connected";
}

export const TOOLKIT_LABELS: Record<ConnectorToolkit, string> = {
  googledrive: "Google Drive",
  one_drive: "OneDrive",
  sharepoint_graph: "SharePoint",
  gmail: "Gmail",
  slack: "Slack",
  notion: "Notion",
  granola_mcp: "Granola",
  wispr: "Wispr Flow",
};
