import { isConnectorToolkit, type ConnectorToolkit } from "@/lib/connector-toolkits";

export function validateToolkit(input: { toolkit: string; profile_id?: string | undefined }): {
  toolkit: ConnectorToolkit;
  profile_id: string | null;
} {
  if (!input || !isConnectorToolkit(input.toolkit)) throw new Error("Unsupported connector");
  return { toolkit: input.toolkit, profile_id: input.profile_id ?? null };
}

/** Server functions receive the caller's active profile id (multi-org users). */
export function validateProfileId(input: { profile_id?: string | undefined } | undefined): {
  profile_id: string | null;
} {
  return { profile_id: input?.profile_id ?? null };
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}