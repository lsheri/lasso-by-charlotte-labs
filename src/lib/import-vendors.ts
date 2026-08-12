export type ImportVendor = "chatgpt" | "claude" | "gemini" | "copilot";

export type VendorMeta = {
  id: ImportVendor;
  label: string;
  tier: 1 | 2 | 3;
  tierHint: string;
  accept: string;
  guide: string;
};

export const STEPS_VERIFIED = "Steps verified Aug 10, 2026.";

export const VENDORS: Record<ImportVendor, VendorMeta> = {
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    tier: 1,
    tierHint: "Full fidelity",
    accept: ".zip,.json",
    guide:
      "About 2 minutes of your time, then a wait of 20 minutes to 24 hours. ChatGPT exports everything at once, you'll choose what to bring in on your own computer before anything is uploaded.\n1. chatgpt.com → profile icon → Settings → Data controls.\n2. Export data → confirm.\n3. Wait for OpenAI's email (check spam); the download link expires after 24 hours.\n4. Unzip and drop the file here, conversations.json is what Lasso reads; large histories may split into conversations-000.json etc., drop them all.\nNotes: no date filter exists; deleted and temporary chats aren't included; edited prompts create branches | Lasso follows the version you kept.",
  },
  claude: {
    id: "claude",
    label: "Claude",
    tier: 1,
    tierHint: "Full fidelity",
    accept: ".zip,.json",
    guide:
      "About 2 minutes, then a few minutes' wait. Claude is the only major tool with a date-range export, use it: exporting just since your last import keeps this quick.\n1. claude.ai on a computer → your initials (bottom-left) → Settings → Privacy.\n2. Under Your data, click Export data.\n3. Choose your date range (or All the first time) → confirm.\n4. Download from Anthropic's email, unzip, drop conversations.json here.\nNotes: titles are often 'Untitled' | Lasso shows the first line instead; very long conversations occasionally lose replies in export | Lasso flags those instead of importing silently; if a full export fails, try three months at a time.",
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    tier: 2,
    tierHint: "Good, grouping approximate",
    accept: ".json,.zip",
    guide:
      "About 4 minutes, then a few hours' wait. Gemini exports through Google Takeout and the path has a trap.\n1. takeout.google.com → Deselect all.\n2. Check My Activity, NOT the product called 'Gemini' (that exports settings, not conversations; this is the most common mistake).\n3. Click Multiple formats → set Activity records to JSON.\n4. Click All activity data included → Deselect all → check only Gemini Apps.\n5. Next step → Create export; the emailed link expires after 7 days.\n6. Unzip; drop Takeout/My Activity/Gemini Apps/MyActivity.json here.\nNotes: Google stores prompts as separate records | Lasso regroups them into conversations approximately and marks them; activity older than 18 months may be auto-deleted; work/school accounts often can't use Takeout, paste those conversations instead.",
  },
  copilot: {
    id: "copilot",
    label: "Copilot",
    tier: 3,
    tierHint: "Summaries only, context, not evidence",
    accept: ".csv,.zip",
    guide:
      "Read this first: Copilot's export contains your prompts plus SUMMARIES of its replies, not the full text. Import it for context and orientation; for any Copilot work that matters, paste the conversation directly (full fidelity).\nConsumer Copilot: account.microsoft.com/privacy → Privacy → Copilot section → Export all activity history → a CSV downloads.\nMicrosoft 365 Copilot (in Word/Teams at work): you can't self-export, use paste.\nNotes: Copilot history is unreliable across devices; Microsoft moves these controls often, tell us if the steps don't match what you see.",
  },
};

export const VENDOR_ORDER: ImportVendor[] = ["chatgpt", "claude", "gemini", "copilot"];
