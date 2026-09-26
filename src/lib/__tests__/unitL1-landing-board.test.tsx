import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { EVENT_DIM_KEYS, LANDING_SEE_IT_WORK_LOCATIONS, LANDING_VIEW_SURFACES, guardEventDims } from "../event-dim-allowlist";
import { parseLandingProof } from "../landing-proof-shared";
import { publicSafeWork } from "../public-work-allowlist";

const page = readFileSync("src/components/marketing/LandingBoard.tsx", "utf8");
const route = readFileSync("src/routes/landing-board.tsx", "utf8");
const home = readFileSync("src/routes/index.tsx", "utf8");

describe("Unit L1 scroll-driven landing board", () => {
  it("is the signed-out home while the old path redirects with its hash", () => {
    expect(route).toContain('createFileRoute("/landing-board")');
    expect(route).toContain('redirect({ to: "/", ...(hash ? { hash } : {}), replace: true })');
    expect(home).toContain("<LandingBoard />");
    expect(home).toContain('if (data.user) throw redirect({ to: "/home" })');
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
  it("restores all three product clips with posters and existing play-event coverage", () => {
    for (const asset of ["use-bring-work-in", "use-reasoning-stays-with-the-firm", "use-every-number-has-a-source"]) {
      expect(page).toContain(`${asset}.mp4.asset.json`);
      expect(page).toContain(`${asset}.webm.asset.json`);
      expect(page).toContain(`${asset}-poster.jpg.asset.json`);
    }
    expect(page).toContain("LANDING_BOARD_USE_CASES.map");
    expect(page).toContain('event(viewId, "landing.usecase_played", { card, input_mode: inputMode })');
    expect(page).toContain('aria-label={`Play: ${card.title}`}');
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
    expect(EVENT_DIM_KEYS["landing.proof_link_opened"]).toEqual(["step", "target"]);
    expect(LANDING_SEE_IT_WORK_LOCATIONS).toEqual(["hero", "hero_workboard"]);
    expect(LANDING_VIEW_SURFACES).toContain("landing-classic");
    expect(guardEventDims("landing.story_section_viewed", { section: "ask", input_mode: "jump", content: "no" }).dims).toEqual({ section: "ask", input_mode: "jump" });
    expect(guardEventDims("landing.pilot_cta_clicked", { placement: "header" }).dims).toEqual({ placement: "header" });
  });
  it("derives every proof figure from turns 2, 4, and 6", () => {
    const proof = parseLandingProof({ itemId: "public-item", title: "Partnership scenarios: year-two net benefit", vendor: "claude", turns: [
      { turn_no: 2, role: "assistant", ts: "2026-08-28T23:07:00Z", content: "Working from the FY25 audited statements you shared and the Meridian cost sheet from the 14 August call: Scenario A, marketing affiliation with Northgate. Year-two net benefit about $0.3M. Scenario B, shared services with Meridian. Combined back-office savings of $2.1M in year two, less $0.7M of transition cost. Net $1.4M in year two. Scenario C, full merger with Meridian. Net about $1.2M in year two." },
      { turn_no: 4, role: "assistant", ts: null, content: "Four lines from the Meridian cost sheet, each matched to YellowSigil's FY25 actuals: finance and accounting $0.6M, HR and benefits administration $0.4M, IT and licensing $0.7M, revenue cycle $0.4M. Total $2.1M." },
      { turn_no: 6, role: "assistant", ts: null, content: "Note under the chart: revenue cycle savings ($0.4M) depend on Meridian's vendor contract extending to YellowSigil volumes; unconfirmed as of 14 August." },
    ] });
    expect(proof).toMatchObject({ scenarioA: 0.3, scenarioB: 1.4, scenarioC: 1.2, savings: 2.1, transition: 0.7 });
    expect(proof?.lines.map((line) => line.amount)).toEqual([0.6, 0.4, 0.7, 0.4]);
  });
  it("keeps the proof link, source connector, honest wording, and phone gutters", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).toContain('search={{ item: proof.itemId, turn: 4, from: returnTo }}');
    expect(page).toContain("lb-proof-connector");
    expect(page).toContain("sourceRef");
    expect(page.toLowerCase()).not.toContain("verified by lasso");
    expect(css).toContain("translate(-65%, -58%) scale(.66)");
    expect(css).toContain(".lb-caption-stack,.lb-sticky-stage:has");
  });
  it("renders the full decision chat at step seven with one marked turn", () => {
    expect(page).toContain('data-testid="landing-decision-transcript"');
    expect(page).toContain('turns.map((turn)');
    expect(page).toContain('data-decision={turn.turn_no === 5 ? "true" : undefined}');
    expect(page).toContain('turn: 5, from: "story"');
    expect(page).toContain('step: "7", target: "turn"');
    expect(page).toContain('const shownPositions = step === 5 ? [1] : step === 6 ? [2]');
    expect(page).toContain('const showProof = step === 5');
    expect(page).toContain('The full chat, with the decision highlighted. Open it and read it yourself.');
  });
  it("keeps the proof compact, proportional, capitalized, and connector-isolated", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).toContain("(line.amount / model.savings) * 100");
    expect(page).toContain('step === 4 ? <svg className="lb-circle-link"');
    expect(page).toContain('thread.scrollTo({ top: proofCard.offsetTop, behavior: "auto" })');
    expect(page).toContain('const showProof = step === 5 && replay.phase === "done" && proof && proofModel');
    const parser = readFileSync("src/lib/landing-proof-shared.ts", "utf8");
    expect(parser).toContain('replace(/^unconfirmed/i, "Unconfirmed").replace("14 August", "14 Aug")');
    expect(css).toContain(".lb-proof-card h4 strong { font-size: 40px;");
    expect(css).toContain('background: color-mix(in srgb, var(--nb-lasso-green) 8%, transparent)');
  });
  it("shows the proof connector on story steps 6 to 8, but not step 5", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).toContain('step >= 5 && step <= 7 ? <path data-testid="landing-proof-connector"');
    expect(page).not.toContain('step === 4 ? <path data-testid="landing-proof-connector"');
    expect(css).toContain('.lb-stage-window:is([data-step="6"],[data-step="7"],[data-step="8"]) .lb-connectors { opacity: 1; }');
    expect(css).toContain('.lb-proof-connector { stroke: var(--nb-lasso-green); stroke-width: 1.5; stroke-dasharray: 6 4; }');
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
  it("keeps the active caption visible and locks jump state", () => {
    expect(page).toContain('<StoryCaption step={active} nonce={attentionNonce}');
    expect(page).toContain('data-step={index + 1}');
    expect(page).toContain('if (jumpTarget.current !== null) return;');
    expect(page).toContain('activate(index, "jump", true)');
  });
  it("keeps the step-one hero on a clean background", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain('.lb-stage-window[data-step="1"] .lb-board-layer { opacity: 0;');
    expect(css).toContain('.lb-stage-window[data-step="1"] .lb-board-card { opacity: 0; }');
  });
  it("holds scenes, settles events, and reuses Ask Lasso presentation pieces", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain("min-height: 160vh");
    expect(css).toContain("min-height: 130vh");
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
    expect(page).toContain('lassoBox && step >= 4 && attentionStep === step');
    expect(page).toContain('pathLength="1"');
    expect(page).toContain("Confirm the vendor extension assumption.");
    expect(page).toContain("Confirm approval by Oct 1.");
  });
  it("uses one settled spotlight on the deck, Ask panel, and decision turn", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).toContain('step === 4 ? "deck" : step === 5 ? "ask" : step === 6 ? "turn"');
    expect(page).toContain('data-testid="landing-story-spotlight"');
    expect(css).toContain("backdrop-filter: blur(3px)");
    expect(css).toContain("color-mix(in srgb, var(--nb-ink) 30%, transparent)");
    expect(css).toContain("lb-spotlight-in 300ms");
  });
  it("draws the net waterfall bar at the honest 1.4 to 2.1 ratio", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const savings = Number(css.match(/\.lb-waterfall-savings i \{ height: (\d+)px;/)?.[1]);
    const net = Number(css.match(/\.lb-waterfall-net i \{ height: (\d+)px;/)?.[1]);
    expect(net / savings).toBeCloseTo(1.4 / 2.1, 2);
    expect(page).toContain('className="lb-waterfall-costs"');
    expect(page).toContain('data-units="0.7"');
    const costsBackground = css.match(/\.lb-waterfall-costs i \{[^}]*background: ([^;]+);/)?.[1]?.trim();
    expect(costsBackground).toBe("var(--nb-red)");
    expect(costsBackground).not.toBe("transparent");
  });
  it("sources the Ask client and engagement labels rather than inventing a client name", () => {
    expect(page).toContain("<h3>{clientLabel}</h3>");
    expect(page).toContain('{engagementTitle}');
    expect(page).toContain('clientLabel={result.engagement.clientLabel ?? ""}');
    expect(page).toContain("engagementTitle={result.engagement.title}");
    expect(page).not.toContain("YellowSigil Mobility");
  });
  it("measures the number after transforms and keeps Ask out of the page scroll path", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).toContain("getBoundingClientRect()");
    expect(page).toContain('event.propertyName === "transform"');
    expect(page).toContain('new MutationObserver');
    expect(page).toContain('[data-testid=landing-proof-card]');
    expect(page).toContain('measureFrameRef.current = window.requestAnimationFrame(tick)');
    expect(page).toContain('sourceRect.width <= 0 || sourceRect.height <= 0');
    expect(page).toContain("layerRect.width / layer.offsetWidth");
    expect(page).toContain("thread.scrollTo");
    expect(css).toContain(".lb-replay-thread { min-height: 0; flex: 1; overflow: hidden;");
    expect(page).toContain('data-story-scroll="locked"');
  });
  it("announces and animates only settled captions with a reduced-motion answer", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).toContain('aria-live={phase === "incoming" ? "polite" : undefined}');
    expect(page).toContain("setAttentionNonce");
    expect(page).toContain('data-phase={phase}');
    expect(css).toContain("lb-caption-in 360ms");
    expect(css).toContain("lb-caption-out 160ms");
    expect(css).toContain("var(--lb-word-index) * 40ms");
    expect(css).toContain("lb-caption-crossfade 150ms");
    expect(css).toContain("lb-target-ring 600ms");
  });
});