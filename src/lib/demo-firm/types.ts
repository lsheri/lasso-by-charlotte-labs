/**
 * The demo firm (Liam, 16 Nov, firm brain buyer sessions). An invented strategy boutique whose 30 boards are written
 * here as data, so the seed is repeatable, reviewable and resettable. Engagement shapes come from published consulting
 * playbooks and the patterns in public case studies; every firm, client, person and number is invented.
 */

export type DemoRole = "admin" | "lead" | "em";

export type DemoPerson = {
  key: string;
  name: string;
  /** Workspace role: partners are admins or leads, everyone else em. */
  role: DemoRole;
  title: "Partner" | "Principal" | "Manager" | "Consultant" | "Analyst" | "Operations" | "Head of Client Success";
  practice: DemoPractice;
};

export type DemoPractice =
  | "Education and workforce"
  | "Health"
  | "Operating model and strategy ops"
  | "Growth and marketing"
  | "Social impact"
  | "Transactions"
  | "Firm";

/** The five ways real boards are laid out (see the catalogue): by week, by phase with workstreams, and so on. */
export type DemoShape = "sprint" | "phased" | "diligence" | "retainer" | "research";

export type DemoItemType = "document" | "deck" | "ai_thread" | "call" | "sheet" | "email";

export type DemoVendor = "claude" | "chatgpt" | "granola" | "google_docs" | "google_slides" | "upload";

export type DemoTurn = { role: "user" | "assistant"; content: string };

export type DemoItem = {
  /** Unique within the board, kebab case. */
  key: string;
  title: string;
  type: DemoItemType;
  vendor: DemoVendor;
  /** A person key from the roster; must be on the board's team. */
  author: string;
  /** One of the board's sections (or workstreams, for phased boards). */
  section: string;
  /** YYYY-MM-DD, inside the engagement's dates. */
  date: string;
  /** Markdown for documents, sheets, emails and calls. Decks use "## Slide N" headings, one per slide. */
  body?: string;
  /** AI chats only: the conversation, user first. */
  turns?: DemoTurn[];
  /** The index card a later model reads: 2 to 4 plain sentences. */
  summary: string;
  /** What was decided, newline separated, or omitted. */
  decisions?: string;
  /** Comma separated names, topics, tools. */
  entities?: string;
  /** Privacy fixtures: private items and unplaced items must never reach a firm surface. */
  visibility?: "mapped" | "private";
  placed?: boolean;
  /** Deliverables put in front of the client, oldest first. */
  shown?: { on: string; occasion: string }[];
  /** Another item key on this board that this one was made from (a chat that produced a document). */
  madeFrom?: string;
  /** Item keys this one informed (an interview that fed a deck). */
  informs?: string[];
  /** A proposal the firm wrote (meta.deliverable_kind); proposals keep their fee under a "## Fees" heading so a reader can withhold it. */
  kind?: "proposal";
  /** Active boards' red pen decks: the exact sentences in body that no other item supports. Tests check they exist. */
  unsupported?: string[];
};

export type DemoSticky = { section: string; text: string; fill: "yellow" | "green" | "blue" | "pink" | "grey" };

export type DemoBoard = {
  /** Stable id within the firm, b1 to b30. */
  key: string;
  practice: Exclude<DemoPractice, "Firm">;
  client: { name: string; type: string };
  title: string;
  /** The engagement shape borrowed from public case studies, in our own words. */
  pattern: string;
  shape: DemoShape;
  start: string;
  weeks: number;
  /** As written in the SOW, for comparables: "$140k" or "$45k/month". */
  fee: string;
  status: "active" | "closed";
  sharedWithFirm: boolean;
  brief: string;
  /** Person keys; the first is the board's owner (the engagement manager). */
  team: string[];
  /** Section frames in order: "Week 1", "Week 2", or phase names. */
  sections: string[];
  /** Phased boards only: workstream names (become tasks and outlines). */
  workstreams?: string[];
  items: DemoItem[];
  stickies?: DemoSticky[];
  /** A pursuit: an incoming opportunity with notes but no engagement work yet, so the delivery rules (item count, red pen deck) do not apply. */
  pursuit?: boolean;
  /** Closed boards: the close-out answers. */
  outcome?: { ranToPlan: boolean; extended: boolean; lesson: string };
};

export type DemoFirm = {
  name: string;
  people: DemoPerson[];
  boards: DemoBoard[];
};
