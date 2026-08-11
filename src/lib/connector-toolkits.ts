export const CONNECTOR_TOOLKITS = [
  "googledrive",
  "one_drive",
  "sharepoint_graph",
  "gmail",
  "slack",
  "notion",
  "granola_mcp",
] as const;
export type ConnectorToolkit = (typeof CONNECTOR_TOOLKITS)[number];

/** Toolkits whose contents are browsed folder-first in the connector picker. */
export const BROWSABLE_TOOLKITS = ["googledrive", "one_drive", "sharepoint_graph"] as const;
export type BrowsableToolkit = (typeof BROWSABLE_TOOLKITS)[number];

export function isBrowsableToolkit(value: unknown): value is BrowsableToolkit {
  return typeof value === "string" && (BROWSABLE_TOOLKITS as readonly string[]).includes(value);
}

/** work_items.source per browsable toolkit — also the dedupe partition. */
export const TOOLKIT_SOURCE: Record<BrowsableToolkit, string> = {
  googledrive: "connector:googledrive",
  one_drive: "connector:onedrive",
  sharepoint_graph: "connector:sharepoint",
};

export const TOOLKIT_VENDOR: Record<BrowsableToolkit, string> = {
  googledrive: "gdrive",
  one_drive: "onedrive",
  sharepoint_graph: "sharepoint",
};

/** meta key holding the provider's file id, used to dedupe re-imports. */
export const TOOLKIT_ID_KEY: Record<BrowsableToolkit, string> = {
  googledrive: "drive_file_id",
  one_drive: "onedrive_item_id",
  sharepoint_graph: "sharepoint_item_id",
};

export type ConnectorStatus = "not_connected" | "pending" | "connected" | "disconnected";

export function isConnectorToolkit(value: unknown): value is ConnectorToolkit {
  return typeof value === "string" && (CONNECTOR_TOOLKITS as readonly string[]).includes(value);
}

export function driveWorkType(mimeType: string | undefined): "document" | "deck" | "sheet" {
  const m = (mimeType ?? "").toLowerCase();
  if (m.includes("presentation") || m.includes("powerpoint")) return "deck";
  if (m.includes("spreadsheet") || m.includes("excel") || m.includes("csv")) return "sheet";
  return "document";
}
