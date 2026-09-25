import claudeLogo from "@/assets/claude-logo.png.asset.json";

const TOOL_LOGO_ASSETS: Record<string, string | undefined> = {
  claude: claudeLogo.url,
  chatgpt: undefined,
  gemini: undefined,
  googledrive: undefined,
  gmail: undefined,
};

const TOOL_LABELS: Record<string, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  googledrive: "Drive",
  gmail: "Gmail",
  document: "Document",
  upload: "Document",
};

function normaliseTool(tool: string): string {
  const value = tool.toLowerCase().replace(/^connector:/, "").replace(/^mcp:/, "");
  if (value.includes("claude")) return "claude";
  if (value.includes("chatgpt") || value.includes("openai")) return "chatgpt";
  if (value.includes("gemini")) return "gemini";
  if (value.includes("drive")) return "googledrive";
  if (value.includes("gmail")) return "gmail";
  return value;
}

export function ToolLogo({ vendor, compact = false }: { vendor: string; compact?: boolean }) {
  const key = normaliseTool(vendor);
  const logo = TOOL_LOGO_ASSETS[key];
  const label = TOOL_LABELS[key] ?? vendor;
  return (
    <span className="lb-tool-identity" data-tool={key}>
      {logo ? <img src={logo} alt="" aria-hidden="true" /> : null}
      <span>{compact ? label : label.toUpperCase()}</span>
    </span>
  );
}