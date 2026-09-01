import type { BrandKey } from "@/components/connectors/BrandLogo";
import type { ToolId } from "@/lib/onboarding-tools";
import type { ToolVendor } from "@/lib/work-taxonomy";

/**
 * ONE place maps a picked tool or a stored vendor to the brand mark it wears.
 * Anything without a real mark returns null, and the surface falls back to its
 * notebook glyph rather than inventing a logo.
 */
const TOOL_BRAND: Partial<Record<ToolId, BrandKey>> = {
  claude: "claude",
  chatgpt: "chatgpt",
  gemini: "gemini",
  copilot: "copilot",
  googledrive: "googledrive",
  gmail: "gmail",
  granola: "granola",
  transcripts: "googledrive",
};

export function brandForTool(tool: ToolId): BrandKey | null {
  return TOOL_BRAND[tool] ?? null;
}

const VENDOR_BRAND: Partial<Record<ToolVendor, BrandKey>> = {
  claude: "claude",
  chatgpt: "chatgpt",
  gemini: "gemini",
  copilot: "copilot",
};

export function brandForVendor(vendor: ToolVendor): BrandKey | null {
  return VENDOR_BRAND[vendor] ?? null;
}
