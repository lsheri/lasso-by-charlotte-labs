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
  copilot: "Microsoft Copilot",
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
  const key = toolkit.toLowerCase().replace(/[_\s-]/g, "");
  if (key.startsWith("googledrive") || key === "gdrive") return "googledrive";
  if (key.startsWith("gmail")) return "gmail";
  if (key.startsWith("onedrive")) return "onedrive";
  if (key.startsWith("sharepoint")) return "sharepoint";
  if (key.startsWith("notion")) return "notion";
  if (key.startsWith("granola")) return "granola";
  if (key.startsWith("googlecalendar")) return "googlecalendar";
  if (key.startsWith("claude") || key === "anthropic") return "claude";
  if (key.startsWith("chatgpt") || key === "openai") return "chatgpt";
  if (key.startsWith("copilot") || key.startsWith("microsoftcopilot")) return "copilot";
  if (key.startsWith("gemini")) return "gemini";
  return "unknown";
}
