/**
 * Pass 164: one walkthrough, written for the account it is opened in.
 *
 * Everything here is pure content and pure banding. The push phrase and the
 * connector steps are read from mcp-setup-steps.ts so this can never drift
 * from the connector card.
 */
import { MCP_PUSH_PHRASE, MCP_SETUP_STEPS, MCP_SERVER_NAME } from "@/lib/mcp-setup-steps";
import { isCoach } from "@/lib/role-access";
import { isBusinessOrg } from "@/hooks/use-profile";

export const WALKTHROUGH_VARIANTS = ["personal", "company_member", "coach"] as const;
export type WalkthroughVariant = (typeof WALKTHROUGH_VARIANTS)[number];

export const WALKTHROUGH_ENTRIES = ["sidebar", "checklist", "empty_state"] as const;
export type WalkthroughEntry = (typeof WALKTHROUGH_ENTRIES)[number];

/** Closed vocabulary. Every section built below uses one of these ids. */
export const WALKTHROUGH_SECTIONS = [
  "say_the_sentence",
  "connect_ai",
  "where_work_lands",
  "mapping",
  "engagements",
  "notes_about_your_work",
  "invite_a_coach",
  "what_you_can_see",
  "reading_a_record",
  "leaving_a_note",
  "next_step",
] as const;
export type WalkthroughSectionId = (typeof WALKTHROUGH_SECTIONS)[number];

export const DAYS_SINCE_SIGNUP_BANDS = ["0", "1-7", "8-30", "30+"] as const;
export type DaysSinceSignupBand = (typeof DAYS_SINCE_SIGNUP_BANDS)[number];

const DAY = 86400000;

export function daysSinceSignupBand(
  createdAt: string | number | Date | null | undefined,
  now: number = Date.now(),
): DaysSinceSignupBand {
  if (createdAt == null) return "0";
  const time = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  if (!Number.isFinite(time)) return "0";
  const days = Math.floor((now - time) / DAY);
  if (days <= 0) return "0";
  if (days <= 7) return "1-7";
  if (days <= 30) return "8-30";
  return "30+";
}

/** A coach is a guest first, then business or personal decides the rest. */
export function walkthroughVariant(
  profile: { role: string; org_type: string } | null | undefined,
): WalkthroughVariant {
  if (isCoach(profile)) return "coach";
  return isBusinessOrg(profile) ? "company_member" : "personal";
}

export type WalkthroughVideo = { src: string; poster: string; label: string };

export type WalkthroughSection = {
  id: WalkthroughSectionId;
  title: string;
  /** Read as plain paragraphs. A person with no sound gets the same content. */
  body: string[];
  /** Rendered as an ordered list under the paragraphs when present. */
  steps?: readonly string[];
  video?: WalkthroughVideo;
};

export type WalkthroughNextStep = { label: string; to: string; note: string };

export type Walkthrough = {
  variant: WalkthroughVariant;
  title: string;
  intro: string;
  sections: WalkthroughSection[];
  next: WalkthroughNextStep;
};

const VIDEO_CLAUDE: WalkthroughVideo = {
  src: "/videos/lasso-claude.mp4",
  poster: "/videos/poster-claude.jpg",
  label: "A conversation being sent to Lasso from Claude",
};

const VIDEO_ARTIFACT: WalkthroughVideo = {
  src: "/videos/lasso-work-artifact.mp4",
  poster: "/videos/poster-work-artifact.jpg",
  label: "A finished piece of work opened in Lasso",
};

const VIDEO_FED_THIS: WalkthroughVideo = {
  src: "/videos/lasso-what-fed-this.mp4",
  poster: "/videos/poster-what-fed-this.jpg",
  label: "The chats that fed one deliverable",
};

const VIDEO_FACT_CHECK: WalkthroughVideo = {
  src: "/videos/lasso-fact-check.mp4",
  poster: "/videos/poster-fact-check.jpg",
  label: "The parts of a piece of work worth checking",
};

function sayTheSentence(): WalkthroughSection {
  return {
    id: "say_the_sentence",
    title: "Say one sentence at the end of a session",
    body: [
      `When you are done working with an AI, say: "${MCP_PUSH_PHRASE}" That one sentence is the whole habit. The conversation comes across with its turns intact, and you keep working.`,
      `In your AI's connector list Lasso shows up as "${MCP_SERVER_NAME}". If nothing arrives, the connector is not set up yet, and the next section fixes that.`,
    ],
    video: VIDEO_CLAUDE,
  };
}

function connectAi(): WalkthroughSection {
  return {
    id: "connect_ai",
    title: "Connect the AI you already use",
    body: [
      "You paste your personal Lasso URL into your AI once. Nothing arrives until you ask for it, so connecting on its own sends nothing.",
      `In Claude: ${MCP_SETUP_STEPS.claude.join(" ")}`,
      `In ChatGPT: ${MCP_SETUP_STEPS.chatgpt.join(" ")}`,
    ],
  };
}

function whereWorkLands(extra: string): WalkthroughSection {
  return {
    id: "where_work_lands",
    title: "Where the work lands",
    body: [
      "Everything arrives private and unmapped, in Work. Private means it is yours alone. Unmapped means it has no home yet, so nobody else can reach it.",
      extra,
    ],
    video: VIDEO_ARTIFACT,
  };
}

const personal: Walkthrough = {
  variant: "personal",
  title: "How Lasso works",
  intro:
    "Your work is captured from the AI you already use, it lands private, and you decide what to do with it. Ten minutes here saves you a week of guessing.",
  sections: [
    sayTheSentence(),
    connectAi(),
    whereWorkLands(
      "You can read any item back, see the chats that fed a finished piece of work, and delete anything you would rather not keep.",
    ),
    {
      id: "mapping",
      title: "Mapping is how you choose",
      body: [
        "Mapping an item gives it a home. Until you map it, nothing is shared with anyone. After you map it, it belongs to that piece of work and can be shared as part of it.",
        "Map the work you are proud of and the work you want a second opinion on. Leave the rest alone.",
      ],
      video: VIDEO_FED_THIS,
    },
    {
      id: "invite_a_coach",
      title: "Invite a coach when you want a second read",
      body: [
        "You can invite a coach to look at what you choose to share. They see the work you shared and nothing else. Your private and unmapped work stays with you.",
        "A coach can leave notes on your work, and those notes appear under Notes about your work.",
      ],
    },
  ],
  next: {
    label: "Connect your AI",
    to: "/connectors",
    note: "Paste your Lasso URL into Claude or ChatGPT, then push one conversation.",
  },
};

const companyMember: Walkthrough = {
  variant: "company_member",
  title: "How Lasso works",
  intro:
    "Your work is captured from the AI you already use, it lands private, and you decide what gets mapped to an engagement. Ten minutes here saves you a week of guessing.",
  sections: [
    sayTheSentence(),
    connectAi(),
    whereWorkLands(
      "Nobody in your organization sees an item while it sits private and unmapped, whatever their role.",
    ),
    {
      id: "engagements",
      title: "What an engagement is",
      body: [
        "An engagement is one body of client work, held by your organization. It has workstreams inside it, and the people who work on it.",
        "Engagements are the shape your organization already thinks in, so the record reads the same way for everyone.",
      ],
    },
    {
      id: "mapping",
      title: "Mapping, and who can see it",
      body: [
        "Mapping an item to an engagement is the moment it stops being only yours. From then on it can be read by the people on that engagement and by anyone the engagement is shared with.",
        "Unmapped work is never included, and marking an item private keeps it out even after mapping.",
      ],
      video: VIDEO_FED_THIS,
    },
    {
      id: "notes_about_your_work",
      title: "Where notes about your work appear",
      body: [
        "When a coach or a lead writes about your work, it appears under Notes about your work, and on the engagement it came from. Newest first, in their words.",
        "Nobody is shown whether you read a note.",
      ],
    },
  ],
  next: {
    label: "Map your first piece of work",
    to: "/work",
    note: "Pick one item in Work and give it a home on an engagement.",
  },
};

const coach: Walkthrough = {
  variant: "coach",
  title: "How Lasso works",
  intro:
    "You are here as a guest. You read the work people chose to share with you, and you leave notes on it. Nothing else is visible to you.",
  sections: [
    {
      id: "what_you_can_see",
      title: "What you can and cannot see",
      body: [
        "You see the engagements someone shared with you, and the work they mapped to those engagements. That is the whole of it.",
        "Private work, unmapped work and raw files stay with the person. You are not shown who read what, and neither is anyone else.",
      ],
    },
    {
      id: "reading_a_record",
      title: "How to read someone's record",
      body: [
        "Open People you coach, then open a person. Their shared work is listed newest first, and each finished piece can be opened to see the chats that fed it.",
        "Reading a piece of work end to end tells you how it was arrived at, not only what came out. That is usually where the useful conversation is.",
      ],
      video: VIDEO_FACT_CHECK,
    },
    {
      id: "leaving_a_note",
      title: "How to leave a note",
      body: [
        "A note has three parts: what went well, what you would try, and what to watch next. Write it in your own words, plainly.",
        "The person reads it under Notes about your work. It is for them, not for a file.",
      ],
    },
  ],
  next: {
    label: "Open the person you coach",
    to: "/coaching",
    note: "Start with the most recent thing they shared.",
  },
};

const BY_VARIANT: Record<WalkthroughVariant, Walkthrough> = {
  personal,
  company_member: companyMember,
  coach,
};

export function walkthroughFor(variant: WalkthroughVariant): Walkthrough {
  return BY_VARIANT[variant];
}
