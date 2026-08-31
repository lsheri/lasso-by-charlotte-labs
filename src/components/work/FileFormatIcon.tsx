import {
  fileFormatGlyph,
  resolveFileFormat,
  type FileFormat,
  type FileFormatGlyph,
  type FileFormatInput,
} from "@/lib/file-format";
import { cn } from "@/lib/utils";

/**
 * Pass 140: the card wears the logo of the format it really is. These
 * conventional file type colors live here and nowhere else in the interface.
 */

/** Pass 141: the card logo at twice its old 14px mark. */
export const CARD_FILE_FORMAT_ICON_SIZE = 28;
const GLYPH_FILL: Record<Exclude<FileFormatGlyph, "document">, string> = {
  word: "#2b579a",
  google_docs: "#1a73e8",
  google_slides: "#f9ab00",
  powerpoint: "#d24726",
  google_sheets: "#0f9d58",
  excel: "#217346",
};

const GLYPH_LETTER: Record<Exclude<FileFormatGlyph, "document">, string> = {
  word: "W",
  google_docs: "D",
  google_slides: "S",
  powerpoint: "P",
  google_sheets: "S",
  excel: "X",
};

/** The neutral document: graphite outline, used for pdf, text and other. */
function DocumentGlyph({ size, className }: { size: number; className?: string | undefined }) {
  return (
    <svg
      data-testid="file-format-glyph-document"
      data-glyph="document"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="var(--nb-graphite)"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <path d="M5.5 3.5h6l3 3v10h-9z" />
      <path d="M11.5 3.5v3h3" />
      <path d="M7.5 10h5" />
      <path d="M7.5 12.8h3.6" />
    </svg>
  );
}

export function FileFormatGlyphMark({
  glyph,
  size = 14,
  className,
}: {
  glyph: FileFormatGlyph;
  size?: number | undefined;
  className?: string | undefined;
}) {
  if (glyph === "document") return <DocumentGlyph size={size} className={className} />;
  const fill = GLYPH_FILL[glyph];
  return (
    <svg
      data-testid={`file-format-glyph-${glyph}`}
      data-glyph={glyph}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <path
        d="M4.6 3.4h6.2l4.6 4.4v8.8a.8.8 0 0 1-.8.8H4.6a.8.8 0 0 1-.8-.8V4.2a.8.8 0 0 1 .8-.8z"
        fill={fill}
      />
      <path d="M10.8 3.4 15.4 7.8h-3.8a.8.8 0 0 1-.8-.8z" fill="#ffffff" fillOpacity={0.35} />
      <text
        x="9.6"
        y="14.4"
        textAnchor="middle"
        fontSize="7.4"
        fontWeight="700"
        fontFamily="var(--font-mono, monospace)"
        fill="#ffffff"
      >
        {GLYPH_LETTER[glyph]}
      </text>
    </svg>
  );
}

/** The format icon for a piece of work, resolved from the record itself. */
export function FileFormatIcon({
  item,
  size = 14,
  className,
}: {
  item: FileFormatInput | null | undefined;
  size?: number | undefined;
  className?: string | undefined;
}) {
  const format: FileFormat = resolveFileFormat(item);
  return <FileFormatGlyphMark glyph={fileFormatGlyph(format)} size={size} className={className} />;
}
