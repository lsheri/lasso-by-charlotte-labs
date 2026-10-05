import { describe, expect, it } from "vitest";

import { clientDisplayName, clientKind, clientKindFromHost } from "../mcp-client-kind";

describe("M3-C3a client kind", () => {
  it("maps Claude and ChatGPT callbacks by host", () => {
    expect(clientKind(null, "https://claude.ai/api/mcp/auth_callback")).toBe("claude");
    expect(clientKind(null, "https://claude.com/cb")).toBe("claude");
    expect(clientKind(null, "https://chatgpt.com/connector_platform_oauth_redirect")).toBe("chatgpt");
    expect(clientKind(null, "https://platform.openai.com/cb")).toBe("chatgpt");
  });

  it("never matches a lookalike host", () => {
    expect(clientKindFromHost("https://claude.ai.evil.com/cb")).toBeNull();
    expect(clientKindFromHost("https://evilclaude.ai/cb")).toBeNull();
  });

  it("a name alone gets the kind but never the host-earned label", () => {
    expect(clientKind("  Claude  ", "https://evil.com/cb")).toBe("claude");
    expect(clientKindFromHost("https://evil.com/cb")).toBeNull();
    expect(clientDisplayName("  Claude  ", "https://evil.com/cb")).toBe("Claude");
    expect(clientDisplayName("  claude impostor ", "https://evil.com/cb")).toBe("claude impostor");
  });

  it("maps cursor, other, and cuts long names", () => {
    expect(clientKind("Cursor", null)).toBe("cursor");
    expect(clientKind(null, "cursor://anysphere.cursor-retrieval/oauth")).toBe("cursor");
    expect(clientKind("Some Tool", null)).toBe("other");
    expect(clientDisplayName("x".repeat(100), null)).toHaveLength(60);
    expect(clientDisplayName("   ", null)).toBeNull();
  });
});
