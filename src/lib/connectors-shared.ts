import { isConnectorToolkit, type ConnectorToolkit } from "@/lib/connector-toolkits";

export function validateToolkit(input: { toolkit: string }): { toolkit: ConnectorToolkit } {
  if (!input || !isConnectorToolkit(input.toolkit)) throw new Error("Unsupported connector");
  return { toolkit: input.toolkit };
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}