import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { EVENT_DIM_KEYS, guardEventDims } from "../event-dim-allowlist";
import { publicSafeWork } from "../public-work-allowlist";

const page = readFileSync("src/components/marketing/LandingBoard.tsx", "utf8");
const route = readFileSync("src/routes/landing-board.tsx", "utf8");

describe("Unit L1 scroll-driven landing board", () => {
  it("is an isolated public noindex route", () => {
    expect(route).toContain('createFileRoute("/landing-board")');
    expect(route).toContain("noindex, nofollow");
    expect(route).not.toContain("beforeLoad");
  });
  it("loads YSM-01 only through the public demo function", () => {
    expect(page).toContain("openDemoBoardFn");
    expect(page).toContain('code: "YSM-01"');
    expect(page).not.toContain("supabase");
  });
  it("renders ten observed reversible steps and jump controls", () => {
    expect(page).toContain('window.addEventListener("scroll"');
    expect(page).toContain("window.innerHeight * 0.55");
    expect(page).toContain('jumpTarget.current = index');
    expect(page).toContain('behavior: "auto"');
    const steps = page.slice(page.indexOf("export const LANDING_BOARD_STEPS"), page.indexOf("] as const;"));
    expect(steps.match(/key: "/g)).toHaveLength(10);
  });
  it("has a reduced-motion jump path", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('scroll-behavior: auto !important');
  });
  it("contains no write controls", () => {
    for (const copy of ["Delete", "Share link", "Add work", "Comment", "Push to"]) expect(page).not.toContain(copy);
  });
  it("maps every board tool to an official asset or Simple Icons path", () => {
    const logo = readFileSync("src/components/marketing/ToolLogo.tsx", "utf8");
    for (const mark of ["siClaude", "siGooglegemini", "siGoogledrive", "siGmail"]) expect(logo).toContain(mark);
    for (const tool of ["claude", "chatgpt", "gemini", "googledrive", "gmail", "powerpoint"]) expect(logo).toContain(`${tool}:`);
    expect(logo).toContain('key === "powerpoint"');
    expect(logo).toContain("compact ? label : label.toUpperCase()");
    const tools = page.slice(page.indexOf("const TOOL_BADGES"), page.indexOf("] as const;", page.indexOf("const TOOL_BADGES")));
    expect(tools).not.toContain("<svg");
  });
  it("allowlists every landing event dimension", () => {
    expect(EVENT_DIM_KEYS["landing.section_jumped"]).toEqual(["section"]);
    expect(guardEventDims("landing.story_section_viewed", { section: "ask", input_mode: "jump", content: "no" }).dims).toEqual({ section: "ask", input_mode: "jump" });
    expect(guardEventDims("landing.pilot_cta_clicked", { placement: "header" }).dims).toEqual({ placement: "header" });
  });
  it("keeps representative board work inside the public allowlist", () => {
    const [item] = publicSafeWork([{ id: "w1", title: "Deck", type: "deck", source: "upload", visibility: "mapped", captured_at: "2026-09-25", content_ref: "storage/private", owner_id: "person", work_item_tasks: [] }]);
    expect(item).toMatchObject({ id: "w1", title: "Deck", type: "deck" });
    expect(item).not.toHaveProperty("content_ref");
    expect(item).not.toHaveProperty("owner_id");
  });
  it("uses product labels, a single deliverable, and citation-aware pins", () => {
    expect(page).toContain('<VendorMark item={item} />');
    expect(page).toContain('keptContentLabel(item, turnCount)');
    expect(page).toContain('board.turns[item.id]?.length');
    expect(page).toContain('item.id !== deckItem?.id');
    expect(page).toContain('citedIds.has(item.id)');
    expect(page).toContain('className="lb-read-dot"');
  });
  it("hides the redundant first caption and locks jump state", () => {
    expect(page).toContain('{settledStep > 0 ? <article key={`${settledStep}-${attentionNonce}`} className="lb-caption lb-caption-attention"');
    expect(page).toContain('if (jumpTarget.current !== null) return;');
    expect(page).toContain('activate(index, "jump", true)');
  });
  it("holds scenes, settles events, and reuses Ask Lasso presentation pieces", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain("min-height: 170vh");
    expect(css).toContain("scroll-snap-type: y proximity");
    expect(css).toContain("scroll-snap-align: start");
    expect(page).toContain("setTimeout(finish, 700)");
    expect(page).toContain("}, 800)");
    expect(page).toContain("<ThinkingTrail");
    expect(page).toContain("<AnswerRail");
    expect(page).toContain("<ContextAudit");
    expect(page).toContain("<MarkdownMessage");
    expect(page).toContain("<Textarea");
  });
  it("anchors the lasso to the number slide and limits open notes", () => {
    expect(page).toContain('data-testid="landing-board-number"');
    expect(page).toContain('className={`lb-slide-lasso${pulse(4)}`}');
    expect(page).toContain("Confirm the vendor extension assumption.");
    expect(page).toContain("Confirm approval by Oct 1.");
  });
  it("draws the net waterfall bar at the honest 1.4 to 2.1 ratio", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const savings = Number(css.match(/\.lb-waterfall-savings i \{ height: (\d+)px;/)?.[1]);
    const net = Number(css.match(/\.lb-waterfall-net i \{ height: (\d+)px;/)?.[1]);
    expect(net / savings).toBeCloseTo(1.4 / 2.1, 2);
    expect(page).toContain('className="lb-waterfall-costs"');
    expect(page).toContain('data-units="0.7"');
  });
  it("sources the Ask client and engagement labels rather than inventing a client name", () => {
    expect(page).toContain("<h3>{clientLabel}</h3>");
    expect(page).toContain('{engagementTitle}');
    expect(page).toContain("clientLabel={result.engagement.clientLabel}");
    expect(page).toContain("engagementTitle={result.engagement.title}");
    expect(page).not.toContain("YellowSigil Mobility");
  });
  it("measures the number after transforms and keeps Ask out of the page scroll path", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).toContain("getBoundingClientRect()");
    expect(page).toContain('event.propertyName === "transform"');
    expect(page).toContain("layerRect.width / layer.offsetWidth");
    expect(page).toContain("thread.scrollTo");
    expect(css).toContain(".lb-replay-thread { min-height: 0; flex: 1; overflow: hidden;");
    expect(page).toContain('data-story-scroll="locked"');
  });
  it("announces and animates only settled captions with a reduced-motion answer", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).toContain('aria-live="polite"');
    expect(page).toContain("setAttentionNonce");
    expect(page).toContain("lb-caption-attention");
    expect(css).toContain("lb-caption-attention 400ms");
    expect(css).toContain("lb-caption-crossfade 150ms");
    expect(css).toContain("lb-target-ring 600ms");
  });
});