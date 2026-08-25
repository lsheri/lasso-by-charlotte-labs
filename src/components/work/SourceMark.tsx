import {
  siClaude,
  siGithubcopilot,
  siGmail,
  siGoogledocs,
  siGoogledrive,
  siGooglegemini,
  siGooglesheets,
  siGoogleslides,
  siNotion,
} from "simple-icons";

import { useVendorVisible } from "@/hooks/use-vendor-display";
import { vendorLabel } from "@/lib/conversation-shared";
import { hueStyles, vendorHue, workIdentity } from "@/lib/work-identity";
import { driveMarkKey } from "@/lib/work-mark";
import { sourceLabel, type WorkItemRow } from "@/lib/work-types";

/**
 * The one place a work item's ORIGIN is drawn. Official brand marks, official
 * brand colours, never recoloured to our palette, because a logo is a fact
 * about where the work came from and not a decoration.
 *
 * Anything we cannot honestly identify renders nothing at all: a manual upload
 * with no detectable origin gets no mark and no empty gap.
 */

type Brand = { title: string; hex: string; path: string };

/** Vendors simple-icons ships a mark for. */
const VENDOR_BRANDS: Record<string, Brand> = {
  claude: siClaude,
  anthropic: siClaude,
  gemini: siGooglegemini,
  google_gemini: siGooglegemini,
  copilot: siGithubcopilot,
  githubcopilot: siGithubcopilot,
  notion: siNotion,
  gmail: siGmail,
  gdrive: siGoogledrive,
  googledrive: siGoogledrive,
  "google drive": siGoogledrive,
};

/** Vendors with no simple-icons entry: they wear the lettermark fallback. */
const LETTERMARKS: Record<string, { letters: string; label: string }> = {
  chatgpt: { letters: "GPT", label: "ChatGPT" },
  openai: { letters: "GPT", label: "OpenAI" },
  slack: { letters: "SL", label: "Slack" },
  granola: { letters: "GR", label: "Granola" },
  onedrive: { letters: "OD", label: "OneDrive" },
  sharepoint: { letters: "SP", label: "SharePoint" },
  microsoft: { letters: "MS", label: "Microsoft" },
};

type SourceItem = {
  source?: WorkItemRow["source"] | undefined;
  source_vendor?: WorkItemRow["source_vendor"];
  source_meta?: WorkItemRow["source_meta"];
  meta?: WorkItemRow["meta"];
};

function normalise(value: string | null | undefined): string | null {
  const v = value?.trim().toLowerCase();
  return v ? v : null;
}

/** Which mark a Drive item wears is decided once, in work-mark. */
const DRIVE_BRANDS: Record<string, Brand> = {
  googledocs: siGoogledocs,
  googlesheets: siGooglesheets,
  googleslides: siGoogleslides,
  googledrive: siGoogledrive,
};

/** The vendor key behind an item, from the vendor field or the source prefix. */
export function sourceVendorKey(item: SourceItem): string | null {
  const direct = normalise(item.source_vendor) ?? normalise(item.source_meta?.vendor);
  if (direct && direct !== "other") return direct;
  const source = normalise(item.source);
  if (!source) return null;
  for (const prefix of ["connector:", "mcp:", "import:"]) {
    if (source.startsWith(prefix)) {
      const rest = source.slice(prefix.length);
      if (!rest || rest === "push" || rest === "other" || rest === "mcp") return null;
      return rest;
    }
  }
  if (source === "manual" || source === "upload" || source === "mcp" || source === "paste") {
    return null;
  }
  return source;
}

export function sourceBrand(item: SourceItem): Brand | null {
  const key = sourceVendorKey(item);
  if (!key) return null;
  if (key === "googledrive" || key === "gdrive" || key === "google drive") {
    return DRIVE_BRANDS[driveMarkKey(item)] ?? siGoogledrive;
  }
  return VENDOR_BRANDS[key] ?? null;
}

/**
 * The brand logo for where a piece of work came from, on the title line and
 * before the title. Returns null when the origin is unknown.
 */
export function SourceMark({
  item,
  size = 13,
  className = "",
}: {
  item: SourceItem;
  size?: number;
  className?: string;
}) {
  const visible = useVendorVisible();
  const key = sourceVendorKey(item);
  // Coaches in a vendor-neutral org do not get to read the brand off a logo.
  if (!key || !visible) return null;
  const brand = sourceBrand(item);
  const letters = LETTERMARKS[key];
  const label = brand?.title ?? letters?.label ?? vendorLabel(key);

  if (brand) {
    return (
      <svg
        role="img"
        aria-label={label}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`inline-block shrink-0 align-[-0.12em] ${className}`}
      >
        <title>{label}</title>
        <path d={brand.path} fill={`#${brand.hex}`} />
      </svg>
    );
  }

  if (!letters) return null;
  const hue = vendorHue(key);
  const styles = hue ? hueStyles(hue) : null;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center rounded-full px-1 py-px font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.06em] ${className}`}
      style={
        styles
          ? { color: styles.color, backgroundColor: styles.background }
          : { color: "var(--muted-foreground)", backgroundColor: "var(--secondary)" }
      }
    >
      {letters.letters}
    </span>
  );
}

/**
 * Rule for artifacts pushed from a conversation: the LLM's logo before the
 * title, and what the artifact is right after it, in the type's own hue so it
 * reads as a different fact from the title.
 */
export function ArtifactNote({
  item,
  className = "",
}: {
  item: Pick<WorkItemRow, "type"> & { source_meta?: WorkItemRow["source_meta"] };
  className?: string;
}) {
  if (item.source_meta?.role !== "attachment") return null;
  const identity = workIdentity(item);
  return (
    <span
      className={`whitespace-nowrap text-xs font-normal ${className}`}
      style={{ color: hueStyles(identity.hue).color }}
    >
      (artifact, {identity.label.toLowerCase()})
    </span>
  );
}

/**
 * Where a piece of work came from, said quietly in words. Muted, smaller than
 * the title, and absent entirely when we do not actually know the source.
 */
export function VendorMark({ item }: { item: SourceItem }) {
  const visible = useVendorVisible();
  const vendor = item.source_vendor ?? null;
  const label = vendor
    ? visible
      ? vendorLabel(vendor)
      : "AI"
    : item.source
      ? sourceLabel(item.source)
      : null;
  if (!label || label === "mcp" || label === "manual") return null;
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
      {label}
    </span>
  );
}
