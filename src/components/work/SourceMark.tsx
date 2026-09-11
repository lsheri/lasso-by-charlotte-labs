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

import { hashId } from "@/components/work/pile-scatter";
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
  /** Evidence for which Google app mark a Drive item wears. */
  type?: string | null | undefined;
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

/**
 * Four circles drawn by hand on a 24x24 box: centre near 12, radius wobbling
 * between roughly 10.2 and 11.6, so the outline is visibly not a machine
 * `border-radius: 50%`. All four read as a circle; none is a blob.
 */
const DISC_PATHS = [
  "M12 1.4 C17.3 1.5 22.6 6.2 22.5 12.3 C22.4 18 17.6 22.6 11.7 22.5 C6.1 22.4 1.5 17.4 1.6 11.6 C1.7 6.1 6.4 1.3 12 1.4 Z",
  "M11.8 1.6 C17.8 1.4 22.4 6.6 22.3 12 C22.2 17.4 18.2 22.4 12.2 22.4 C6.5 22.4 1.7 18.2 1.8 12.2 C1.9 6.5 6 1.8 11.8 1.6 Z",
  "M12.3 1.5 C18.2 2 22.3 6 22.4 11.8 C22.5 17.8 17.9 22.3 12 22.5 C6.2 22.7 1.6 18 1.5 12 C1.4 6.3 6.4 1 12.3 1.5 Z",
  "M12 1.7 C17.5 1.2 22.5 6.5 22.2 12.4 C21.9 18.1 17.3 22.7 11.6 22.3 C6.2 21.9 1.6 17.7 1.8 11.9 C2 6.4 6.6 2.2 12 1.7 Z",
] as const;

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
  disc = false,
}: {
  item: SourceItem;
  size?: number;
  className?: string;
  /**
   * Draw a white, hand-drawn circle behind the mark. On a pastel note a brand
   * mark sits straight on the tint and disappears; the disc gives it a page to
   * stand on. Off by default, so every other caller renders as before.
   */
  disc?: boolean;
}) {
  const visible = useVendorVisible();
  const key = sourceVendorKey(item);
  // Coaches in a vendor-neutral org do not get to read the brand off a logo.
  // The disc lives INSIDE this guard on purpose: an empty white circle where a
  // logo was withheld would leak the fact that there was one.
  if (!key || !visible) return null;
  const brand = sourceBrand(item);
  const letters = LETTERMARKS[key];
  const label = brand?.title ?? letters?.label ?? vendorLabel(key);

  if (brand) {
    const mark = (
      <svg
        role="img"
        aria-label={label}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={disc ? "relative block" : `inline-block shrink-0 align-[-0.12em] ${className}`}
      >
        <title>{label}</title>
        <path d={brand.path} fill={`#${brand.hex}`} />
      </svg>
    );
    if (!disc) return mark;
    const box = size + 9;
    // Four hands, not one stamp: which circle a tool wears is stable per vendor
    // so the page is not a grid of identical outlines.
    const path = DISC_PATHS[hashId(key) % DISC_PATHS.length]!;
    return (
      <span
        className={`relative inline-flex shrink-0 items-center justify-center align-[-0.24em] ${className}`}
        style={{ width: box, height: box }}
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          width={box}
          height={box}
          className="absolute inset-0"
        >
          <path
            d={path}
            fill="var(--nb-white)"
            stroke="color-mix(in oklab, var(--nb-pencil) 30%, transparent)"
            strokeWidth={0.75}
          />
        </svg>
        {mark}
      </span>
    );
  }

  if (!letters) return null;
  const hue = vendorHue(key);
  const styles = hue ? hueStyles(hue) : null;
  // There is no sane hand-drawn circle around a wide pill, so on paper the pill
  // gets a white base under its tint and separates the same way a logo does.
  const pillBackground = styles
    ? disc
      ? `color-mix(in oklab, var(${hue}) 14%, var(--nb-white))`
      : styles.background
    : disc
      ? "var(--nb-white)"
      : "var(--secondary)";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center rounded-full px-1 py-px font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.06em] ${className}`}
      style={{
        color: styles ? styles.color : "var(--muted-foreground)",
        backgroundColor: pillBackground,
      }}
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
