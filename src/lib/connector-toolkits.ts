export const CONNECTOR_TOOLKITS = ["googledrive", "gmail", "slack", "notion"] as const;
export type ConnectorToolkit = (typeof CONNECTOR_TOOLKITS)[number];

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