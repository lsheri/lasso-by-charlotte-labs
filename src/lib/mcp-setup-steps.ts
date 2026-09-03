/**
 * The one definition of how a person connects Claude or ChatGPT to Lasso.
 * Both the onboarding card and the Connectors card render from here, so the
 * wording can never drift into two versions again.
 */

export type McpVendor = "claude" | "chatgpt";

export const MCP_SETUP_STEPS: Record<McpVendor, readonly string[]> = {
  claude: [
    "Open Claude → Settings → Connectors.",
    "Add custom connector.",
    "Paste your Lasso URL, save, and allow it when Claude asks.",
  ],
  chatgpt: [
    "Open ChatGPT → Settings → Connectors (turn on Developer mode if you don't see it).",
    "Add → custom MCP server.",
    "Paste your Lasso URL, save, and allow it when ChatGPT asks.",
  ],
};

export const MCP_VENDORS: readonly McpVendor[] = ["claude", "chatgpt"];

/** What Claude and ChatGPT show in their connector list once it is added. */
export const MCP_SERVER_NAME = "Lasso by Charlotte Labs";

/** What people say at the end of a session to send the work over. */
export const MCP_PUSH_PHRASE = "Push this conversation to Lasso.";

/** Said before a new URL is issued, on every surface that issues one. */
export const MCP_REGENERATE_WARNING =
  "A new URL replaces the old one. Any AI already set up with the old URL stops being able to push until you paste the new one in.";

export const VENDOR_LABELS: Record<McpVendor, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
};

/** Where the setup steps were opened from. Closed vocabulary. */
export type SetupSurface = "connectors" | "connect_sheet" | "onboarding";
