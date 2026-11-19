/**
 * 19 Nov 2026: the words of /privacy and /terms, and the facts they rest on. Both pages are public and name the
 * product Lasso in every look (Liam, D-40): a carrier reviewer checks that the name on the page, on the opt-in and
 * on the text itself is one name, so these strings never go through the brand rewrite.
 *
 * The wording is a draft until Liam approves it. Its full text is mirrored for him in .pane/prompts/policy-drafts.md,
 * rendered from this file. Change a sentence here and render that file again.
 */
import { TEXT_CONSENT_WORDING } from "@/lib/text-consent-shared";

/**
 * What only Liam can supply. A null fact is a gap: every sentence that needs it is left out of the page instead of
 * being guessed. Fill one here and the sentence appears.
 */
export const LEGAL_FACTS: {
  product: string;
  company: string;
  updated: string;
  contactEmail: string;
  legalEntity: string | null;
  postalAddress: string | null;
  governingState: string | null;
  minimumAge: number | null;
} = {
  product: "Lasso",
  company: "Charlotte Labs",
  updated: "19 November 2026",
  // Already public on the landing page. Liam to confirm it is the address he wants on legal pages.
  contactEmail: "liam@charlotte-labs.com",
  // Liam, card Q-41 (D-43), 19 Nov: "Charlotte Labs doing business as Lasso - Washington State". No Inc. or LLC given.
  legalEntity: "Charlotte Labs, doing business as Lasso",
  postalAddress: null,
  governingState: "Washington",
  minimumAge: null,
};

export type LegalBlock =
  | string
  | { list: readonly string[] }
  | { quote: string }
  | { rows: readonly (readonly [string, string])[] }
  | { links: readonly { to: "/privacy" | "/terms" | "/trust" | "/texts"; label: string }[] }
  | { contact: string };

export type LegalSection = { id: string; title: string; blocks: readonly LegalBlock[] };
export type LegalDoc = {
  label: string;
  title: string;
  description: string;
  updated: string;
  intro: string;
  sections: readonly LegalSection[];
};

type Facts = typeof LEGAL_FACTS;

/**
 * The company's full name, said once per page where the page says who it is from: "Who we are" in the policy, the
 * opening line of the terms. Every other sentence uses the short name, facts.company.
 */
function entityName(facts: Facts): string {
  return facts.legalEntity ?? facts.company;
}

function present<T>(items: readonly (T | null)[]): T[] {
  return items.filter((item): item is T => item !== null);
}

export function privacyPolicy(facts: Facts = LEGAL_FACTS): LegalDoc {
  const company = facts.company;
  return {
    label: "Privacy",
    title: "Privacy policy",
    description: "What Lasso collects, how it is used, who can see it, and how text messages work.",
    updated: facts.updated,
    intro: `Lasso is workspace software made by ${company}. This page says what we collect when you use Lasso, what we do with it, and what we never do.`,
    sections: [
      {
        id: "who",
        title: "Who we are",
        blocks: present<LegalBlock>([
          `Lasso is made and run by ${entityName(facts)} ("we", "us"). It is offered at lasso.charlotte-labs.com.`,
          facts.postalAddress ? `Our address is ${facts.postalAddress}.` : null,
          "This policy covers the Lasso website and app, and the text messages Lasso sends.",
        ]),
      },
      {
        id: "collect",
        title: "What we collect",
        blocks: [
          {
            rows: [
              [
                "Your account",
                "Your name, email address, sign-in details and the workspaces you belong to.",
              ],
              [
                "Your work",
                "What you choose to bring into Lasso: conversations with AI tools, documents, files, notes, and the boards you arrange them on. Nothing is imported unless you select it.",
              ],
              [
                "Connected sources",
                "If you link a source such as a file store, we receive only the items you pick from it. Linking is your choice, per source and per item.",
              ],
              [
                "How the app is used",
                "Clicks, page load times and replays of the screen. Everything readable is masked in your browser before it is sent, so the replays show shapes and not your words.",
              ],
              [
                "Your mobile number",
                "Only if you give it to us and agree to receive text messages. We keep your name, your number, the wording you agreed to and the date and time you agreed.",
              ],
              ["Messages to us", "What you send when you write to us for help."],
            ],
          },
        ],
      },
      {
        id: "use",
        title: "How we use it",
        blocks: [
          {
            list: [
              "To run Lasso for you: to sign you in, store your work and show it to the people you share it with.",
              "To answer questions and draft documents when you use the AI features.",
              "To send email about your account and workspace, such as invitations and sign-in links.",
              "To send text messages, only to people who agreed to receive them.",
              "To see how the app is used, so we can fix what is slow or confusing.",
              "To keep Lasso secure and to meet our legal duties.",
            ],
          },
        ],
      },
      {
        id: "sees",
        title: "Who can see your work",
        blocks: [
          "You see everything you bring in. Other people see only what you share with them. A workspace admin manages settings, people and invitations, and cannot open anyone's private work.",
          `What ${facts.company} itself can see is set by your workspace's data level. There are five levels, from nothing leaving your workspace to the work itself being shared with us for anything you map or ship. New workspaces start at the highest level, Full work content. A workspace can change its level at any time in Settings, under Your data, and each person can choose the same level or a lower one for themselves. Private and unmapped work never leaves your workspace at any level.`,
          "Our support team can open a workspace only after its admin approves a request. That access is read only, lasts up to 28 days, and every page we open is listed for you in Settings.",
          {
            links: [
              { to: "/trust", label: "Trust and data: who sees what, and the five data levels" },
            ],
          },
        ],
      },
      {
        id: "providers",
        title: "Companies that process data for us",
        blocks: [
          "We use these companies to run Lasso. Each receives only what it needs for its job.",
          {
            rows: [
              ["Supabase", "Database and sign-in."],
              ["Lovable", "Application hosting."],
              ["Composio", "Sign-in to the sources you choose to link."],
              ["Anthropic", "AI answers, drafting and image descriptions (Claude)."],
              ["OpenAI", "A fallback for AI features, used only when Anthropic is unavailable."],
              ["PostHog", "Measuring how the interface is used, with readable content masked."],
              ["Resend", "Sending email."],
              ["Bird", "Sending text messages."],
            ],
          },
        ],
      },
      {
        id: "texts",
        title: "Text messages",
        blocks: [
          "Lasso sends text messages only to people who gave us their mobile number and agreed to receive them. The agreement reads:",
          { quote: TEXT_CONSENT_WORDING },
          "We use your mobile number for one purpose: to send you texts about proposals and projects you have been asked to help with, such as a note that a proposal you worked on has been won. We do not send marketing by text.",
          "We do not sell your mobile number. Mobile numbers and text messaging consent are never sold or shared with third parties or affiliates for marketing or promotional purposes. Your number is passed only to the messaging provider and mobile carriers that deliver the message.",
          "To stop, reply STOP to any message. You will get one message confirming it, and then no more. To start again, reply START. For help, reply HELP or write to us at the address below.",
          "Message frequency varies. Message and data rates may apply. Agreeing to texts is never a condition of using Lasso.",
          { links: [{ to: "/terms", label: "Terms of use: text messaging" }] },
        ],
      },
      {
        id: "never",
        title: "What we never do",
        blocks: [
          {
            list: [
              "We do not sell your data.",
              "We do not train AI models on your content.",
              "We build nothing that rates or ranks people.",
              "We never change your data level without telling you.",
            ],
          },
        ],
      },
      {
        id: "keeping",
        title: "Keeping and deleting",
        blocks: [
          "You can delete any piece of your work at any time. Deleting your account removes your content. Uploaded files are removed from storage with the items that reference them.",
          "Conversations with the AI features are private to the account owner. You can delete any session, along with every message in it, at any time.",
          "If you stop text messages, we keep the record that you agreed and that you stopped, so that we can show we honoured your choice.",
        ],
      },
      {
        id: "choices",
        title: "Your choices",
        blocks: [
          "You can ask us what we hold about you, ask us to correct it, or ask us to delete it. Write to us at the address below and we will answer.",
          "Depending on where you live, the law may give you further rights over your personal information. We will honour a request made under those laws.",
        ],
      },
      ...(facts.minimumAge
        ? [
            {
              id: "age",
              title: "Age",
              blocks: [`Lasso is not for anyone under ${facts.minimumAge}.`] as LegalBlock[],
            },
          ]
        : []),
      {
        id: "changes",
        title: "Changes to this policy",
        blocks: [
          "If we change this policy we will post the new version here and change the date at the top. If a change affects how we use what we already hold, we will tell you before it takes effect.",
        ],
      },
      {
        id: "contact",
        title: "Contact",
        blocks: [
          `Questions about this policy or your data go to ${company}:`,
          { contact: facts.contactEmail },
        ],
      },
    ],
  };
}

export function termsOfUse(facts: Facts = LEGAL_FACTS): LegalDoc {
  const company = facts.company;
  const entity = entityName(facts);
  return {
    label: "Terms",
    title: "Terms of use",
    description: "The terms for using Lasso, including the terms for its text messages.",
    updated: facts.updated,
    intro: `These terms are the agreement between you and ${entity}${entity.includes(",") ? "," : ""} for using Lasso. By using Lasso you agree to them.`,
    sections: [
      {
        id: "service",
        title: "The service",
        blocks: [
          `Lasso is workspace software made by ${company}. It keeps a record of work done with AI tools and helps teams use it.`,
          "Lasso is in a pilot. Every plan is free during the pilot, and features may change. When pricing turns on, nothing is charged without your yes.",
        ],
      },
      {
        id: "account",
        title: "Your account",
        blocks: [
          "Keep your sign-in details to yourself, and tell us if you think someone else has used your account. You are responsible for what is done through it.",
          "If you use Lasso for an organization, you confirm you are allowed to accept these terms for it.",
        ],
      },
      {
        id: "work",
        title: "Your work",
        blocks: [
          "Your work belongs to you. You give us permission to store it, process it and show it to the people you share it with, so that Lasso can do what you ask of it.",
          "What we may see and use beyond that is set by your workspace's data level, described in the privacy policy. We do not sell your data and we do not train AI models on your content.",
          "Only bring into Lasso what you have the right to bring. If your work includes other people's information, you are responsible for having the right to share it.",
          { links: [{ to: "/privacy", label: "Privacy policy" }] },
        ],
      },
      {
        id: "use",
        title: "Using Lasso fairly",
        blocks: [
          {
            list: [
              "Do not use Lasso to break the law or to harm anyone.",
              "Do not try to reach work, accounts or systems you have not been given access to.",
              "Do not interfere with Lasso or put an unreasonable load on it.",
              "Do not use Lasso to rate or rank people.",
            ],
          },
          "We may suspend an account that breaks these terms.",
        ],
      },
      {
        id: "ai",
        title: "AI features",
        blocks: [
          "Lasso uses AI models to answer questions and draft documents. Their output can be wrong or incomplete. Check it against the sources Lasso shows you before you rely on it. You are responsible for the work you send out.",
        ],
      },
      {
        id: "texts",
        title: "Text messaging",
        blocks: [
          `Who sends: ${company}, as Lasso.`,
          "What we send: texts about proposals and projects you have been asked to help with, for example that a proposal you worked on has been won and its team board is ready. We do not send marketing by text.",
          "How you join: you give your mobile number and tick a box that reads:",
          { quote: TEXT_CONSENT_WORDING },
          "Agreeing to texts is your choice. It is never a condition of using Lasso or of buying anything.",
          {
            list: [
              "Message frequency varies.",
              "Message and data rates may apply. Your mobile plan decides what a text costs you.",
              "Reply STOP to any message to opt out. You will get one message confirming it, and then no more.",
              "Reply START to receive messages again.",
              `Reply HELP for help, or write to ${facts.contactEmail}.`,
              "Texts are sent to mobile numbers in the United States and Canada.",
              "Mobile carriers are not liable for delayed or undelivered messages.",
            ],
          },
          "Tell us if your number changes or passes to someone else, so that we stop sending to it.",
          "How we handle your mobile number is in the privacy policy. We never sell it, and we never share it or your consent with third parties for marketing.",
          { links: [{ to: "/privacy", label: "Privacy policy: text messages" }] },
        ],
      },
      {
        id: "others",
        title: "Other services",
        blocks: [
          "Lasso can connect to services run by other companies, such as the AI tools and file stores you link. Their terms cover your use of them, and we are not responsible for how they behave.",
        ],
      },
      {
        id: "ending",
        title: "Ending",
        blocks: [
          "You can stop using Lasso and delete your account at any time. We may end or suspend your access if you break these terms, or if we stop offering Lasso. If we stop offering it, we will give you notice and a way to take your work with you where we reasonably can.",
        ],
      },
      {
        id: "warranty",
        title: "No guarantee",
        blocks: [
          "Lasso is provided as it is. To the extent the law allows, we give no warranty that it will be uninterrupted or free of errors, or that it will fit a particular purpose.",
          "To the extent the law allows, we are not liable for indirect or consequential loss, or for loss of profit, revenue or data, arising from your use of Lasso. Nothing in these terms limits a liability that the law does not allow us to limit.",
        ],
      },
      ...(facts.governingState
        ? [
            {
              id: "law",
              title: "Governing law",
              blocks: [
                `These terms are governed by the laws of the State of ${facts.governingState}, and its courts decide any dispute about them.`,
              ] as LegalBlock[],
            },
          ]
        : []),
      {
        id: "changes",
        title: "Changes to these terms",
        blocks: [
          "If we change these terms we will post the new version here and change the date at the top. If you keep using Lasso after a change takes effect, you accept the new terms.",
        ],
      },
      {
        id: "contact",
        title: "Contact",
        blocks: present<LegalBlock>([
          `Questions about these terms go to ${company}:`,
          { contact: facts.contactEmail },
          facts.postalAddress ? `Our address is ${facts.postalAddress}.` : null,
        ]),
      },
    ],
  };
}

/** A whole document as plain Markdown, for the draft Liam reads and for tests that search every sentence. */
export function legalDocMarkdown(doc: LegalDoc): string {
  const lines: string[] = [
    `## ${doc.title}`,
    "",
    `Last updated: ${doc.updated}`,
    "",
    doc.intro,
    "",
  ];
  doc.sections.forEach((section, index) => {
    lines.push(`### ${index + 1}. ${section.title}`, "");
    for (const block of section.blocks) {
      if (typeof block === "string") lines.push(block, "");
      else if ("list" in block) lines.push(...block.list.map((item) => `- ${item}`), "");
      else if ("quote" in block) lines.push(`> "${block.quote}"`, "");
      else if ("rows" in block)
        lines.push(...block.rows.map(([name, what]) => `- **${name}:** ${what}`), "");
      else if ("links" in block)
        lines.push(...block.links.map((link) => `- Link: ${link.label} (${link.to})`), "");
      else lines.push(block.contact, "");
    }
  });
  return lines.join("\n").trimEnd() + "\n";
}
