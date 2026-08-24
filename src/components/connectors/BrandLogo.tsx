import {
  siClaude,
  siGmail,
  siGoogledocs,
  siGoogledrive,
  siGooglecalendar,
  siGooglegemini,
  siGooglesheets,
  siGoogleslides,
  siNotion,
} from "simple-icons";

/**
 * Full-colour brand marks for connector identity only. This is the same brand
 * truth SourceMark draws from: where simple-icons ships a mark we use it, and
 * where it does not (OneDrive, SharePoint, OpenAI, Granola) we draw one mark
 * here rather than scattering duplicates. Everywhere outside connector identity
 * and source marks, the graphite icon rule still stands.
 */
export type BrandKey =
  | "googledrive"
  | "gmail"
  | "googledocs"
  | "googlesheets"
  | "googleslides"
  | "googlecalendar"
  | "onedrive"
  | "sharepoint"
  | "notion"
  | "granola"
  | "claude"
  | "chatgpt"
  | "gemini"
  | "upload"
  | "thread"
  | "unknown";

const SIMPLE: Partial<Record<BrandKey, { title: string; hex: string; path: string }>> = {
  googledrive: siGoogledrive,
  gmail: siGmail,
  googledocs: siGoogledocs,
  googlesheets: siGooglesheets,
  googleslides: siGoogleslides,
  googlecalendar: siGooglecalendar,
  notion: siNotion,
  claude: siClaude,
  gemini: siGooglegemini,
};

const LABELS: Record<BrandKey, string> = {
  googledrive: "Google Drive",
  gmail: "Gmail",
  googledocs: "Google Docs",
  googlesheets: "Google Sheets",
  googleslides: "Google Slides",
  googlecalendar: "Google Calendar",
  onedrive: "OneDrive",
  sharepoint: "SharePoint",
  notion: "Notion",
  granola: "Granola",
  claude: "Claude",
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  upload: "Upload",
  thread: "Conversation",
  unknown: "Connector",
};

/** Marks simple-icons does not ship. Drawn once, in the vendor's own colour. */
function CustomMark({ brand }: { brand: BrandKey }) {
  if (brand === "onedrive") {
    return (
      <g>
        <path
          fill="#0364B8"
          d="M9.9 6.3a5.4 5.4 0 0 1 9.5 2.1 4.3 4.3 0 0 1-.7 8.5H7.1A4.6 4.6 0 0 1 6.6 7.7a5.4 5.4 0 0 1 3.3-1.4Z"
        />
        <path
          fill="#28A8EA"
          d="M6.9 9.6a4.2 4.2 0 0 1 4 1.2 3.7 3.7 0 0 1 3.6 2.4 3.2 3.2 0 0 1-.6 3.7H6.6a3.7 3.7 0 0 1 .3-7.3Z"
        />
      </g>
    );
  }
  if (brand === "sharepoint") {
    return (
      <g>
        <circle cx="9" cy="8" r="5.2" fill="#036C70" />
        <circle cx="15.4" cy="12" r="4.6" fill="#1A9BA1" />
        <circle cx="11.5" cy="17" r="3.8" fill="#37C6D0" />
      </g>
    );
  }
  if (brand === "chatgpt") {
    return (
      <path
        fill="#10A37F"
        d="M12 2.6 20 7v10l-8 4.4L4 17V7l8-4.4Zm0 2.6L6.3 8.3v7.4L12 18.8l5.7-3.1V8.3L12 5.2Zm0 3 3.2 1.8v3.2L12 15.8 8.8 14v-3.2L12 8.2Z"
      />
    );
  }
  if (brand === "granola") {
    return (
      <g>
        <rect x="3.2" y="4.4" width="17.6" height="15.2" rx="4" fill="#E8763A" />
        <path
          fill="#FFF3E8"
          d="M8 9h8v1.7H8V9Zm0 3.4h8v1.7H8v-1.7Zm0 3.4h5v1.6H8v-1.6Z"
        />
      </g>
    );
  }
  if (brand === "upload") {
    return (
      <g fill="none" stroke="var(--muted-foreground)" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 16V5.5" />
        <path d="m7.8 9.6 4.2-4.1 4.2 4.1" />
        <path d="M4.5 16.5v2.2h15v-2.2" />
      </g>
    );
  }
  if (brand === "thread") {
    return (
      <g fill="none" stroke="var(--muted-foreground)" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M4.5 6.2h15v9.1H10l-4 3.3v-3.3H4.5z" />
      </g>
    );
  }
  return (
    <g fill="none" stroke="var(--muted-foreground)" strokeWidth="1.8">
      <circle cx="12" cy="12" r="7.5" />
      <path d="M8.4 12h7.2" strokeLinecap="round" />
    </g>
  );
}

export function BrandLogo({
  brand,
  size = 28,
  className = "",
}: {
  brand: BrandKey;
  size?: number;
  className?: string;
}) {
  const known = SIMPLE[brand];
  const label = LABELS[brand] ?? LABELS.unknown;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`inline-block shrink-0 align-[-0.12em] ${className}`}
    >
      <title>{label}</title>
      {known ? <path d={known.path} fill={`#${known.hex}`} /> : <CustomMark brand={brand} />}
    </svg>
  );
}

/** Two marks side by side, for surfaces that speak to every assistant. */
export function BrandPair({
  brands,
  size = 22,
}: {
  brands: [BrandKey, BrandKey];
  size?: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <BrandLogo brand={brands[0]} size={size} />
      <BrandLogo brand={brands[1]} size={size} />
    </span>
  );
}

/** Connector toolkit ids to their brand mark. */
export function brandForToolkit(toolkit: string): BrandKey {
  const key = toolkit.toLowerCase();
  if (key.startsWith("googledrive") || key === "gdrive") return "googledrive";
  if (key.startsWith("gmail")) return "gmail";
  if (key.startsWith("onedrive")) return "onedrive";
  if (key.startsWith("sharepoint")) return "sharepoint";
  if (key.startsWith("notion")) return "notion";
  if (key.startsWith("granola")) return "granola";
  if (key.startsWith("googlecalendar")) return "googlecalendar";
  if (key.startsWith("claude") || key === "anthropic") return "claude";
  if (key.startsWith("chatgpt") || key === "openai") return "chatgpt";
  if (key.startsWith("gemini")) return "gemini";
  return "unknown";
}
