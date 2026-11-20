/**
 * The Kestrel Bay demo story: every word the guided story shows, in one file, so a change to the script is a change
 * here and nowhere else (Liam, 19 Nov 2026). Bump `version` with any change to a beat, caption, question or note:
 * the version travels on every story event, so reactions can be read against the script that earned them.
 *
 * Rules for this file:
 * - Never write the product's name. Write {product}; the story fills it from the current brand.
 * - "Kestrel Bay" is the demo firm's name and stays as written.
 * - Nothing about pilots, pricing or next steps. The story's only job is the hook.
 * - No em dashes. Describe the work, never rank or judge a person.
 */

/** Which signed-in window plays a beat: the Partner's or the Engagement lead's. */
export type StoryWindow = "partner" | "lead";

/**
 * Where a beat happens in the app. "firm" is the Firm brain menu row (/firm-brain), where the map sits for the
 * Partner. A board is always the Marrowfield proposal board.
 */
export type StoryPlace = "home" | "firm" | "board";

export type StoryBeat = {
  /** The beat's number in the script, 0 to 8. Stable: events and session storage carry it. */
  n: number;
  window: StoryWindow;
  /** The "You are" chip. */
  youAre: string;
  /** A short name for the beat, shown as the card's heading. */
  title: string;
  /** Self-guided mode: the short caption. */
  caption: string;
  /** Presenter mode: what the presenter says and does. */
  notes: string;
  /** Presenter mode: the one question the presenter asks the viewer. */
  question: string;
  /** Where the beat happens, or null for a card with no product screen. */
  place: StoryPlace | null;
  /** The real surface the beat points at, by its existing test id, when it is on the page. */
  anchor: string | null;
  /** A question to type into Ask the firm on this beat, when it has one. */
  ask: string | null;
  /** On a phone, the card sits at the top of the screen for this beat instead of the bottom. */
  phoneCardAtTop?: true;
};

/** The one question beats 1 and 7 share, so the second answer can be compared with the first. */
const SAME_QUESTION = "Have we designed a new service line for a health system before?";

export const FIRM_STORY_SCRIPT = {
  version: 2,
  /** Shown on every card. */
  demoLine: "Kestrel Bay Advisory is a demo firm. Every client, person and figure in it is fictional.",
  /** The last thing the story says. After it, the story stops talking. */
  closing: "What one engagement learns, the whole firm keeps.",
  /** Beat 0: asked once, before any product screen. */
  rolePick: {
    prompt: "Which is closest to you?",
    choices: [
      { id: "sells", label: "I sell the work" },
      { id: "delivers", label: "I deliver the work" },
      { id: "both", label: "Both" },
    ],
  },
  beats: [
    {
      n: 0,
      window: "partner",
      youAre: "You",
      title: "Your last proposal",
      caption: "Your last proposal: how many hours went into rebuilding what your firm already knew?",
      notes: "Read the line and stop. Let them answer before you show anything.",
      question: "Think of the last proposal you sent. Who built it, and where did they start from?",
      place: null,
      anchor: null,
      ask: null,
    },
    {
      n: 1,
      window: "partner",
      youAre: "Partner",
      title: "A lead lands",
      caption: "A lead lands. Instead of emailing three partners, ask the firm once: have we done this before?",
      notes:
        "A health system wants a diabetes prevention service line. Type the question into Ask the firm. Point at the sources under each line and open What it read: every claim links to work the firm has shared.",
      question: "How would you find that out today?",
      place: "home",
      anchor: "ask-the-firm",
      ask: SAME_QUESTION,
    },
    {
      n: 2,
      window: "partner",
      youAre: "Partner",
      title: "What the firm knows",
      caption: "Firm brain: what the firm knows, not what each partner remembers.",
      notes:
        "Each thread is one engagement, tied to the kind of problem it answered and how the team worked. Pick a problem to see every engagement that met it.",
      question: "If your most senior partner left tomorrow, which of this would leave with them?",
      place: "firm",
      anchor: "firm-brain-map",
      ask: null,
      // The map is taller than a phone screen, so the card at the bottom would sit over its threads.
      phoneCardAtTop: true,
    },
    {
      n: 3,
      window: "partner",
      youAre: "Partner",
      title: "What we charged, how it ended",
      caption: "Past fees and how each engagement ended, without chasing whoever ran it.",
      notes:
        "Use What we charged in Ask the firm. Fees are read from each statement of work and shown to partners only. The line under each engagement says how it ended and what it taught.",
      question: "When you price a new piece of work, whose memory do you rely on?",
      place: "home",
      anchor: "ask-the-firm",
      ask: null,
    },
    {
      n: 4,
      window: "lead",
      youAre: "Engagement lead",
      title: "The handoff",
      caption: "The handoff: the partner's context, plus a first draft assembled from past work. No fees on this screen.",
      notes:
        "This is the proposal board. Open More tools, then Start a proposal: the brief is read from the partner's notes and the draft borrows its structure from past engagements. This person sees no fees. Run Red pen on the draft: it catches a number that the notes do not support.",
      question: "What does the person who delivers the work usually get from the person who sold it?",
      place: "board",
      anchor: null,
      ask: null,
    },
    {
      n: 5,
      window: "partner",
      youAre: "Partner",
      title: "Review, not rewrite",
      caption: "The partner reviews in minutes. Each section shows where it came from, so this is a review, not a rewrite.",
      notes:
        "Open the same board and its draft. Each section names its sources. Confirm the ones that are right; the fee is left for the partner to set.",
      question: "How much of your last proposal review was rewriting, and how much was judgement?",
      place: "board",
      anchor: null,
      ask: null,
    },
    {
      n: 6,
      window: "lead",
      youAre: "Engagement lead",
      title: "It goes out",
      caption: "The proposal goes out, and the private board is shared with the firm. Work arrives in {product} from the tools the team already uses.",
      notes:
        "Open Share and turn on Share with firm. Until now this board was private to the people on it. Say once: work gets into {product} from the tools the team already uses, such as calls, documents and AI chats. Nobody here is asked to add documents.",
      question: "When an engagement ends at your firm, where does what you learned go?",
      place: "board",
      anchor: null,
      ask: null,
    },
    {
      n: 7,
      window: "partner",
      youAre: "Partner",
      title: "Next Monday",
      caption: "Next Monday, any partner asks the same question. The answer now includes this engagement, and the map has one more point.",
      notes:
        "Ask the same question as before. The new engagement is among the sources. Open one of its sources and mark it as an exemplar: the next draft borrows from it. Then open Firm brain: the map has one more thread.",
      question: "How long does it take today before a colleague can build on work you finished last week?",
      place: "home",
      anchor: "ask-the-firm",
      ask: SAME_QUESTION,
    },
    {
      n: 8,
      window: "partner",
      youAre: "You",
      title: "Ask Kestrel Bay anything",
      caption: "Your turn. Ask Kestrel Bay anything, then explore on your own.",
      notes: "Hand over the keyboard. Let them ask in their own words, then let them explore.",
      question: "What would you ask your own firm, if it could answer?",
      place: "home",
      anchor: "ask-the-firm",
      ask: null,
    },
  ],
} as const satisfies {
  version: number;
  demoLine: string;
  closing: string;
  rolePick: { prompt: string; choices: readonly { id: string; label: string }[] };
  beats: readonly StoryBeat[];
};

export type StoryRolePick = (typeof FIRM_STORY_SCRIPT.rolePick.choices)[number]["id"];
