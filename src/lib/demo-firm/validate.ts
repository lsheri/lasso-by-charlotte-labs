import { DEMO_PEOPLE } from "./people";
import type { DemoBoard } from "./types";

const PEOPLE = new Set(DEMO_PEOPLE.map((person) => person.key));
const ITEM_KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLIDE = /^##\s+Slide\s+(\d+)\s*$/gm;

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function textOf(board: DemoBoard): string {
  const parts: string[] = [board.title, board.brief, board.client.name, board.client.type];
  for (const item of board.items) {
    parts.push(item.title, item.summary, item.body ?? "", item.decisions ?? "", item.entities ?? "");
    for (const turn of item.turns ?? []) parts.push(turn.content);
    for (const showing of item.shown ?? []) parts.push(showing.occasion);
  }
  for (const sticky of board.stickies ?? []) parts.push(sticky.text);
  if (board.outcome) parts.push(board.outcome.lesson);
  return parts.join("\n");
}

/** Every problem with one board, in plain words. An empty list means the board is ready to seed. */
export function boardProblems(board: DemoBoard): string[] {
  const problems: string[] = [];
  const say = (text: string) => problems.push(`${board.key}: ${text}`);
  const frames = new Set([...board.sections, ...(board.workstreams ?? [])]);
  const keys = new Set<string>();
  // A week of slack each side: SOWs are signed before the start and close-outs land after the end.
  const earliest = addDays(board.start, -14);
  const latest = addDays(board.start, board.weeks * 7 + 14);

  if (!/^b[1-9]\d?$/.test(board.key)) say("key must be b1 to b99");
  if (board.team.length < 2) say("team needs at least two people");
  for (const person of board.team) if (!PEOPLE.has(person)) say(`team member ${person} is not in the roster`);
  if (board.sections.length < 2) say("needs at least two sections");
  if (board.shape === "phased" && !(board.workstreams?.length)) say("phased boards need workstreams");
  if (board.status === "closed" && !board.outcome) say("closed boards need an outcome");
  if (board.status === "active" && board.outcome) say("active boards have no outcome yet");
  if (board.brief.length < 120) say("brief is too short to be useful");
  if (board.items.length < (board.pursuit ? 3 : 8)) say(`needs at least ${board.pursuit ? 3 : 8} items`);
  if (board.pursuit && (board.status !== "active" || board.sharedWithFirm)) say("a pursuit is active and not shared with the firm");

  for (const item of board.items) {
    const where = `item ${item.key}`;
    if (!ITEM_KEY.test(item.key)) say(`${where}: key must be kebab case`);
    if (keys.has(item.key)) say(`${where}: duplicate key`);
    keys.add(item.key);
    if (!board.team.includes(item.author)) say(`${where}: author ${item.author} is not on the team`);
    if (!frames.has(item.section)) say(`${where}: section "${item.section}" is not a section or workstream`);
    if (!DATE.test(item.date) || item.date < earliest || item.date > latest) say(`${where}: date ${item.date} is outside the engagement`);
    if (item.summary.length < 60) say(`${where}: summary too short`);
    if (item.type === "ai_thread") {
      if (!item.turns || item.turns.length < 2) say(`${where}: chats need at least two turns`);
      else if (item.turns[0]!.role !== "user") say(`${where}: chats start with the user`);
    } else if (!item.body || item.body.length < 40) {
      say(`${where}: needs a body`);
    }
    if (item.type === "deck") {
      SLIDE.lastIndex = 0;
      const slides = [...(item.body ?? "").matchAll(SLIDE)].length;
      if (slides < 4) say(`${where}: decks need at least 4 "## Slide N" headings`);
    }
    for (const sentence of item.unsupported ?? []) {
      if (!(item.body ?? "").includes(sentence)) say(`${where}: unsupported claim not found in body: "${sentence.slice(0, 50)}"`);
    }
    for (const showing of item.shown ?? []) {
      if (!DATE.test(showing.on) || showing.on < item.date) say(`${where}: shown before it was made`);
    }
    if (item.shown?.length && !["document", "deck", "sheet"].includes(item.type)) say(`${where}: only deliverables are shown to clients`);
    if (item.kind === "proposal") {
      if (item.type !== "document") say(`${where}: proposals are documents`);
      if (!/^## Fees\s*$/m.test(item.body ?? "")) say(`${where}: proposals keep their fee under a "## Fees" heading`);
    }
  }
  for (const item of board.items) {
    if (item.madeFrom && !keys.has(item.madeFrom)) say(`item ${item.key}: madeFrom ${item.madeFrom} does not exist`);
    for (const target of item.informs ?? []) if (!keys.has(target)) say(`item ${item.key}: informs ${target} does not exist`);
  }
  for (const sticky of board.stickies ?? []) {
    if (!frames.has(sticky.section)) say(`sticky "${sticky.text.slice(0, 30)}": unknown section`);
  }

  if (board.status === "active" && !board.pursuit) {
    const redPen = board.items.filter((item) => item.type === "deck" && (item.unsupported?.length ?? 0) > 0);
    if (redPen.length === 0) say("active boards need a deck with planted unsupported claims");
    for (const deck of redPen) {
      const count = deck.unsupported!.length;
      if (count < 3 || count > 6) say(`item ${deck.key}: plant 3 to 6 unsupported claims, not ${count}`);
      SLIDE.lastIndex = 0;
      if ([...(deck.body ?? "").matchAll(SLIDE)].length < 8) say(`item ${deck.key}: red pen decks need at least 8 slides`);
    }
  }
  if (board.status === "closed" && !board.items.some((item) => item.shown?.length)) say("closed boards need at least one client-shown deliverable");

  const text = textOf(board);
  if (text.includes("—")) say("contains an em dash");
  if (/lasso/i.test(text)) say('contains "Lasso"');
  if (/charlotte/i.test(text)) say('contains "Charlotte"');
  return problems;
}

export function firmProblems(boards: DemoBoard[]): string[] {
  const problems = boards.flatMap(boardProblems);
  const keys = boards.map((board) => board.key);
  if (new Set(keys).size !== keys.length) problems.push("duplicate board keys");
  const clients = boards.map((board) => board.client.name);
  if (new Set(clients).size !== clients.length) problems.push("duplicate client names");
  return problems;
}
