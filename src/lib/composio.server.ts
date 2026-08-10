import { Composio } from "@composio/core";

import type { ConnectorToolkit } from "@/lib/connector-toolkits";

let client: Composio | undefined;

export function composio(): Composio {
  if (!client) {
    const apiKey = process.env["COMPOSIO_API_KEY"];
    if (!apiKey) throw new Error("Composio is not configured");
    client = new Composio({ apiKey });
  }
  return client;
}

const AUTH_CONFIG_NAMES: Record<ConnectorToolkit, string> = {
  googledrive: "Google Drive Auth Config",
  gmail: "Gmail Auth Config",
  slack: "Slack Auth Config",
  notion: "Notion Auth Config",
};

/** Finds (or creates) the Composio-managed auth config for a toolkit. */
export async function resolveAuthConfigId(toolkit: ConnectorToolkit): Promise<string> {
  const c = composio();
  const existing = await c.authConfigs.list({ toolkitSlug: toolkit });
  const match = existing.items?.[0];
  if (match?.id) return match.id;
  const created = await c.authConfigs.create(toolkit, {
    type: "use_composio_managed_auth",
    name: AUTH_CONFIG_NAMES[toolkit],
  });
  return created.id;
}

export type DriveFile = {
  id?: string;
  name?: string;
  mimeType?: string;
  modifiedTime?: string;
  webViewLink?: string;
};

/** Lists the entity's most recently modified Drive files. */
export async function listDriveFiles(entityId: string, limit = 20): Promise<DriveFile[]> {
  const result = await composio().tools.execute("GOOGLEDRIVE_LIST_FILES", {
    userId: entityId,
    arguments: {
      fields: "id,name,mimeType,modifiedTime,webViewLink",
      order_by: "modifiedTime desc",
      page_size: limit,
      q: "trashed = false",
    },
  });
  if (result.successful === false) throw new Error(result.error ?? "Google Drive request failed");
  const data = (result.data ?? {}) as Record<string, unknown>;
  const files =
    (data["files"] as DriveFile[] | undefined) ??
    ((data["response_data"] as { files?: DriveFile[] } | undefined)?.files ?? []);
  return Array.isArray(files) ? files.slice(0, limit) : [];
}