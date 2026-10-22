/**
 * Shared shapes for the sketch card experiment (SketchCard) and the themed
 * full screen viewer (WorkViewer). Status: exploring, 16 Oct 2026.
 *
 * The card shows a DRAWING of what the work is. The viewer shows the REAL
 * work inside a container themed to the tool it came from. Content here is
 * what the viewer renders; the card never reads it beyond the title.
 */

/**
 * The DISPLAY vocabulary: which tool's face a card wears. Widened 16 Oct from
 * six to eleven so the app's real tools have a member each.
 *
 * This is NOT the telemetry vocabulary. TOOL_VENDORS in src/lib/work-taxonomy.ts
 * is a closed set of eight and stamps events; it is deliberately untouched.
 * Nothing here is ever written to a row or an event, so this union may widen
 * freely whenever a tool gains a face.
 */
export type WorkSource =
  | 'slides'
  | 'docs'
  | 'sheets'
  | 'claude'
  | 'chatgpt'
  | 'granola'
  | 'gemini'
  | 'copilot'
  | 'perplexity'
  | 'wispr'
  | 'gmail'
  | 'other';
export type WorkKind = 'deck' | 'doc' | 'sheet' | 'chat' | 'transcript' | 'email';

export type Slide = {
  kicker?: string;
  title: string;
  bullets?: string[];
  stat?: { value: string; label: string };
};
export type DocBlock = { type: 'h2' | 'p'; text: string };
export type ChatTurn = { role: 'you' | 'assistant'; text: string };
export type TranscriptTurn = { speaker: string; at: string; text: string };
export type SheetCell = string | number;

export type WorkContent =
  | { kind: 'deck'; slides: Slide[] }
  | { kind: 'doc'; heading: string; blocks: DocBlock[] }
  | { kind: 'sheet'; columns: string[]; rows: SheetCell[][] }
  | { kind: 'chat'; turns: ChatTurn[] }
  | {
      kind: 'transcript';
      date?: string;
      attendees?: string[];
      notes?: string[];
      turns: TranscriptTurn[];
    }
  | { kind: 'email'; from: string; to: string[]; subject: string; sent?: string; blocks: DocBlock[] };

export type Work = {
  id: string;
  title: string;
  source: WorkSource;
  /** Overrides the kind the source implies. */
  kind?: WorkKind;
  date?: string;
  /** Provenance: "docs.google.com", "18 turns", "32 min". */
  prov?: string;
  board?: string;
  /** false renders the No board treatment. */
  onBoard: boolean;
  summary?: string;
  /** Where "Open in <tool>" goes. Absent disables the link. */
  url?: string;
  /** The real work. Absent gives the viewer its empty state, never an invented one. */
  content?: WorkContent;
};

export const SOURCE_LABEL: Record<WorkSource, string> = {
  slides: 'Google Slides',
  docs: 'Google Docs',
  sheets: 'Google Sheets',
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  granola: 'Granola',
  gemini: 'Gemini',
  copilot: 'Copilot',
  perplexity: 'Perplexity',
  wispr: 'Wispr Flow',
  gmail: 'Gmail',
  other: 'Other',
};

export const SOURCE_KIND: Record<WorkSource, WorkKind> = {
  slides: 'deck',
  docs: 'doc',
  sheets: 'sheet',
  claude: 'chat',
  chatgpt: 'chat',
  granola: 'transcript',
  gemini: 'chat',
  copilot: 'chat',
  perplexity: 'chat',
  wispr: 'transcript',
  gmail: 'email',
  other: 'doc',
};

export const KIND_LABEL: Record<WorkKind, string> = {
  deck: 'Deck',
  doc: 'Document',
  sheet: 'Sheet',
  chat: 'Chat',
  transcript: 'Call',
  email: 'Email',
};

export function kindOf(work: Work): WorkKind {
  return work.kind ?? work.content?.kind ?? SOURCE_KIND[work.source];
}

/** The two words the drawing writes by hand. */
export function sketchLabel(title: string): string {
  return title.split(/\s+/).slice(0, 2).join(' ').slice(0, 16);
}
