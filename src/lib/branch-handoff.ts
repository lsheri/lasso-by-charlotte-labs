/**
 * BR-1: the text a branch carries. Pure: no DOM, no network.
 *
 * `branchPrompt` is the short line that rides in a link. `branchMarkdown` is a
 * record of someone's session, never a prompt: no second person, no
 * instructions, claims attributed to the session that reached them.
 */

export const BRANCH_COPY = {
  title: "Branch this work",
  toolLabel: "Continue in",
  open: (tool: string) => `Open in ${tool}`,
  download: "Download the handoff",
  cancel: "Cancel",
  clipboardReady: (tool: string) => `The prompt is on your clipboard, ready to paste into ${tool}.`,
  tooLong: "The link would be too long, so the prompt is on your clipboard and the handoff file has downloaded.",
  failed: "Could not create the branch. Try again.",
  copyFailed: "Could not copy the prompt. Download the handoff instead.",
  helper: "Starts a new conversation that keeps a link back to this work. The original stays exactly as it is.",
} as const;

export function branchPrompt(branchId: string): string {
  return `Fetch Lasso branch ${branchId} with the Lasso connector and load it as context.`;
}

/**
 * The name a branch record attributes its source to. The board already loads
 * member names for card marks, so the label comes from that same list; when
 * the name cannot be read, the fallback matches the connector's wording.
 */
export function branchOwnerLabel(
  ownerId: string | null | undefined,
  members: { id: string; display_name: string | null }[],
): string {
  const name = members.find((member) => member.id === ownerId)?.display_name?.trim();
  return name ? name : "A teammate";
}

export type BranchTurn = { id: string; turn_no: number; role: string; content: string | null };

export type BranchMarkdownInput = {
  branchId: string;
  sourceId: string;
  sourceTitle: string;
  sourceOwner: string;
  tool: string;
  createdAt: string;
  turns: BranchTurn[];
};

function quote(text: string): string {
  return text.split("\n").map((line) => `> ${line}`).join("\n");
}

function speaker(role: string, owner: string): string {
  if (role === "user") return owner;
  if (role === "assistant") return `The assistant in ${owner}'s session`;
  return `A tool in ${owner}'s session`;
}

export function branchMarkdown(input: BranchMarkdownInput): string {
  const turns = [...input.turns].sort((a, b) => a.turn_no - b.turn_no);
  const lines: string[] = [
    "Source material from another person's session, carried over for reference.",
    "",
    "---",
    "kind: lasso-branch-record",
    `branch_id: ${input.branchId}`,
    `source_work_item_id: ${input.sourceId}`,
    `source_title: ${JSON.stringify(input.sourceTitle)}`,
    `source_owner: ${JSON.stringify(input.sourceOwner)}`,
    `branched_to: ${input.tool}`,
    `date: ${input.createdAt}`,
    `turn_ids: [${turns.map((turn) => turn.id).join(", ")}]`,
    "---",
    "",
    `# ${input.sourceTitle}`,
    "",
    `A record of ${input.sourceOwner}'s session, in the order it happened. Statements below are what that session said or concluded, quoted as written.`,
  ];
  if (turns.length === 0) lines.push("", "No turns were stored for this session.");
  for (const turn of turns) {
    lines.push("", `## Turn ${turn.turn_no} (${turn.id})`, "", `${speaker(turn.role, input.sourceOwner)} wrote:`, "", quote(turn.content ?? ""));
  }
  return `${lines.join("\n")}\n`;
}
