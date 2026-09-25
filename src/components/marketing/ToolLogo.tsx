import claudeLogo from "@/assets/claude-logo.png.asset.json";
import chatgptLogo from "@/assets/chatgpt-logo.png.asset.json";
import geminiLogo from "@/assets/gemini-logo.png.asset.json";
import googleDriveLogo from "@/assets/google-drive-logo.png.asset.json";
import gmailLogo from "@/assets/gmail-logo.png.asset.json";
import { siClaude, siGmail, siGoogledrive, siGooglegemini } from "simple-icons";
import type { SimpleIcon } from "simple-icons";

const TOOL_LOGO_ASSETS: Record<string, string | undefined> = {
  claude: claudeLogo.url,
  chatgpt: chatgptLogo.url,
  gemini: geminiLogo.url,
  googledrive: googleDriveLogo.url,
  gmail: gmailLogo.url,
};

const TOOL_SIMPLE_ICONS: Record<string, SimpleIcon | undefined> = {
  claude: siClaude,
  gemini: siGooglegemini,
  googledrive: siGoogledrive,
  gmail: siGmail,
};

const TOOL_LABELS: Record<string, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  googledrive: "Drive",
  gmail: "Gmail",
  document: "Document",
  upload: "Document",
  powerpoint: "PowerPoint",
};

function normaliseTool(tool: string): string {
  const value = tool.toLowerCase().replace(/^connector:/, "").replace(/^mcp:/, "");
  if (value.includes("claude")) return "claude";
  if (value.includes("chatgpt") || value.includes("openai")) return "chatgpt";
  if (value.includes("gemini")) return "gemini";
  if (value.includes("drive")) return "googledrive";
  if (value.includes("gmail")) return "gmail";
  if (value.includes("powerpoint") || value.includes("ppt")) return "powerpoint";
  return value;
}

export function ToolLogo({ vendor, compact = false }: { vendor: string; compact?: boolean }) {
  const key = normaliseTool(vendor);
  const logo = TOOL_LOGO_ASSETS[key];
  const simpleIcon = TOOL_SIMPLE_ICONS[key];
  const label = TOOL_LABELS[key] ?? vendor;
  return (
    <span className="lb-tool-identity" data-tool={key}>
      {logo ? <img src={logo} alt="" aria-hidden="true" /> : simpleIcon ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" style={{ color: `#${simpleIcon.hex}` }}>
          <path fill="currentColor" d={simpleIcon.path} />
        </svg>
      ) : key === "powerpoint" ? <span className="lb-powerpoint-badge" aria-hidden="true">P</span> : null}
      <span>{compact ? label : label.toUpperCase()}</span>
    </span>
  );
}