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
  | "slack"
  | "granola"
  | "wispr"
  | "claude"
  | "chatgpt"
  | "copilot"
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

const CUSTOM_HEX: Partial<Record<BrandKey, string>> = {
  onedrive: "#0364B8",
  sharepoint: "#036C70",
  chatgpt: "#000000",
  copilot: "#1B8BE0",
  slack: "#36C5F0",
  granola: "#E8763A",
  wispr: "#111111",
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
  slack: "Slack",
  granola: "Granola",
  wispr: "Wispr Flow",
  claude: "Claude",
  chatgpt: "ChatGPT",
  copilot: "Microsoft Copilot",
  gemini: "Gemini",
  upload: "Upload",
  thread: "Conversation",
  unknown: "Connector",
};

/** The primary brand ink used by the Ledger card's inside edge. */
export function brandHex(brand: BrandKey): string {
  const simple = SIMPLE[brand];
  if (simple) return `#${simple.hex}`;
  return CUSTOM_HEX[brand] ?? "var(--nb-soft)";
}

export function brandLabel(brand: BrandKey): string {
  return LABELS[brand] ?? LABELS.unknown;
}

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
    // The official OpenAI knot.
    return (
      <path
        fill="#000000"
        d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.073zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"
      />
    );
  }
  if (brand === "copilot") {
    return (
      <g>
        <defs>
          <linearGradient id="nb-copilot-grad" x1="2" y1="20" x2="22" y2="4">
            <stop offset="0%" stopColor="#1B8BE0" />
            <stop offset="50%" stopColor="#39A0ED" />
            <stop offset="100%" stopColor="#9A6BF0" />
          </linearGradient>
        </defs>
        <path
          fill="url(#nb-copilot-grad)"
          d="M8.6 4.4h6.8a4 4 0 0 1 3.8 2.8l1.5 4.7a3.4 3.4 0 0 1-3.2 4.4H16v.5a3.2 3.2 0 0 1-3.2 3.2H9.3A5.3 5.3 0 0 1 4 14.7v-1.5a1.6 1.6 0 0 1 .6-1.3l.4-.3-.6-1.9A4 4 0 0 1 8.6 4.4Zm0 2a2 2 0 0 0-1.9 2.6l.8 2.6h6.9a1.7 1.7 0 0 1 1.6 2.2l-.6 2h2.2a1.4 1.4 0 0 0 1.3-1.8l-1.5-4.7a2 2 0 0 0-1.9-1.4H8.6Z"
        />
      </g>
    );
  }
  if (brand === "slack") {
    // Four rounded bars in Slack's own four colours.
    return (
      <g>
        <rect x="3" y="10.3" width="7.7" height="3.4" rx="1.7" fill="#36C5F0" />
        <rect x="10.3" y="3" width="3.4" height="7.7" rx="1.7" fill="#2EB67D" />
        <rect x="13.3" y="10.3" width="7.7" height="3.4" rx="1.7" fill="#ECB22E" />
        <rect x="10.3" y="13.3" width="3.4" height="7.7" rx="1.7" fill="#E01E5A" />
      </g>
    );
  }
  if (brand === "granola") {
    // Granola's mark: one dark spiral, three turns, on its green rounded square.
    return (
      <g>
        <rect x="0.5" y="0.5" width="23" height="23" rx="5" style={{ fill: "var(--brand-granola)" }} />
        <path
          fill="none"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: "var(--brand-granola-ink)" }}
          d="M12.00 11.40 L12.07 11.35 L12.15 11.31 L12.23 11.28 L12.33 11.27 L12.43 11.26 L12.53 11.27 L12.64 11.29 L12.75 11.32 L12.86 11.38 L12.96 11.44 L13.06 11.53 L13.15 11.63 L13.24 11.74 L13.31 11.86 L13.37 12.00 L13.41 12.15 L13.44 12.31 L13.45 12.47 L13.44 12.64 L13.40 12.81 L13.35 12.98 L13.28 13.15 L13.19 13.32 L13.07 13.48 L12.94 13.63 L12.78 13.76 L12.61 13.88 L12.42 13.99 L12.22 14.07 L12.00 14.13 L11.77 14.17 L11.54 14.19 L11.29 14.17 L11.05 14.14 L10.81 14.07 L10.57 13.97 L10.33 13.85 L10.11 13.70 L9.90 13.52 L9.71 13.32 L9.54 13.10 L9.39 12.85 L9.26 12.58 L9.17 12.30 L9.10 12.00 L9.07 11.69 L9.06 11.38 L9.10 11.06 L9.16 10.74 L9.27 10.42 L9.41 10.12 L9.58 9.82 L9.79 9.54 L10.03 9.28 L10.29 9.05 L10.59 8.84 L10.91 8.66 L11.26 8.51 L11.62 8.40 L12.00 8.33 L12.39 8.30 L12.78 8.31 L13.18 8.37 L13.57 8.46 L13.96 8.60 L14.34 8.79 L14.69 9.01 L15.03 9.27 L15.34 9.57 L15.62 9.91 L15.86 10.28 L16.07 10.68 L16.24 11.10 L16.36 11.54 L16.43 12.00 L16.46 12.47 L16.44 12.94 L16.36 13.42 L16.24 13.89 L16.06 14.34 L15.83 14.79 L15.56 15.21 L15.24 15.60 L14.88 15.96 L14.47 16.28 L14.03 16.56 L13.56 16.80 L13.06 16.99 L12.54 17.12 L12.00 17.20 L11.45 17.22 L10.90 17.19 L10.35 17.09 L9.80 16.94 L9.27 16.72 L8.76 16.45 L8.28 16.13 L7.83 15.75 L7.42 15.33 L7.05 14.86 L6.74 14.34 L6.47 13.80 L6.26 13.22 L6.12 12.62 L6.03 12.00 L6.02 11.37 L6.06 10.74 L6.18 10.11 L6.36 9.49 L6.61 8.89 L6.92 8.31 L7.30 7.77 L7.73 7.26 L8.22 6.80 L8.76 6.39 L9.34 6.04 L9.97 5.74 L10.62 5.51 L11.30 5.35 L12.00 5.27 L12.71 5.25 L13.42 5.31 L14.13 5.45 L14.82 5.66 L15.49 5.95 L16.14 6.30 L16.74 6.73 L17.31 7.22 L17.82 7.77 L18.27 8.38 L18.66 9.03 L18.99 9.73 L19.24 10.46 L19.41 11.22 L19.50 12.00 L19.51 12.79 L19.44 13.58 L19.28 14.37 L19.04 15.13 L18.72 15.88 L18.32 16.59 L17.84 17.26 L17.29 17.88 L16.68 18.44 L16.01 18.94 L15.28 19.37 L14.51 19.72 L13.70 19.99 L12.86 20.17 L12.00 20.27 L11.13 20.27 L10.26 20.19 L9.40 20.01 L8.55 19.74 L7.74 19.38 L6.96 18.94 L6.23 18.41 L5.55 17.81 L4.94 17.13 L4.40 16.39 L3.93 15.59 L3.55 14.74 L3.26 13.86 L3.07 12.94 L2.97 12.00 L2.97 11.05 L3.06 10.10 L3.26 9.16 L3.56 8.24 L3.96 7.36 L4.44 6.51 L5.02 5.72 L5.68 4.98 L6.42 4.32 L7.23 3.73 L8.10 3.23 L9.02 2.83 L9.98 2.51 L10.98 2.30 L12.00 2.20"
        />
      </g>
    );
  }
  if (brand === "wispr") {
    // Geometry read off Wispr Flow's own favicon: five white bars, outer two
    // tallest, on their near-black rounded square.
    return (
      <g>
        <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="#111111" />
        <g fill="#FFFFFF">
          <rect x="5.1" y="5.3" width="1.6" height="13.4" rx="0.8" />
          <rect x="8.1" y="12" width="1.6" height="5.4" rx="0.8" />
          <rect x="11.1" y="7.5" width="1.6" height="9" rx="0.8" />
          <rect x="14.1" y="12" width="1.6" height="5.4" rx="0.8" />
          <rect x="17.1" y="5.3" width="1.6" height="13.4" rx="0.8" />
        </g>
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
  const key = toolkit.toLowerCase().replace(/[_\s-]/g, "");
  if (key.startsWith("googledrive") || key === "gdrive") return "googledrive";
  if (key.startsWith("gmail")) return "gmail";
  if (key.startsWith("onedrive")) return "onedrive";
  if (key.startsWith("sharepoint")) return "sharepoint";
  if (key.startsWith("notion")) return "notion";
  if (key.startsWith("slack")) return "slack";
  if (key.startsWith("granola")) return "granola";
  if (key.startsWith("googlecalendar")) return "googlecalendar";
  if (key.startsWith("claude") || key === "anthropic") return "claude";
  if (key.startsWith("chatgpt") || key === "openai") return "chatgpt";
  if (key.startsWith("copilot") || key.startsWith("microsoftcopilot")) return "copilot";
  if (key.startsWith("gemini")) return "gemini";
  return "unknown";
}
