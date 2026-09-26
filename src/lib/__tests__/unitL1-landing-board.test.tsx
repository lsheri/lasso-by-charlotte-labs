import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  EVENT_DIM_KEYS,
  LANDING_SEE_IT_WORK_LOCATIONS,
  LANDING_VIEW_SURFACES,
  guardEventDims,
} from "../event-dim-allowlist";
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
  it("renders ten observed reversible steps without the removed progress rail", () => {
    expect(page).toContain('window.addEventListener("scroll"');
    expect(page).toContain("window.innerHeight * 0.55");
    expect(page).toContain("jumpTarget.current = index");
    expect(page).toContain('behavior: "auto"');
    const steps = page.slice(
      page.indexOf("export const LANDING_BOARD_STEPS"),
      page.indexOf("] as const;"),
    );
    expect(steps.match(/key: "/g)).toHaveLength(10);
    expect(page).not.toContain("StoryProgressRail");
    expect(page).not.toContain('className="lb-progress-rail"');
    expect(page).toContain('event(viewId.current, "landing.section_jumped", { section: key })');
    expect(page).not.toContain('className="lb-step-nav"');
    expect([...page.matchAll(/key: "([^"]+)"/g)].slice(0, 10).map((match) => match[1])).toEqual([
      "problem",
      "canvas",
      "workstreams",
      "deliverable",
      "circle",
      "ask",
      "the-turn",
      "still-open",
      "share",
      "try-it",
    ]);
  });
  it("has a reduced-motion jump path", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("scroll-behavior: auto !important");
  });
  it("contains no write controls", () => {
    for (const copy of ["Delete", "Share link", "Add work", "Comment", "Push to"])
      expect(page).not.toContain(copy);
  });
  it("rotates all three product clips while preserving user-play event coverage", () => {
    for (const clip of [
      "use-bring-work-in",
      "use-every-number-has-a-source",
      "use-reasoning-stays-with-the-firm",
    ]) {
      expect(page).toContain(`useCaseAsset("${clip}.mp4")`);
      expect(page).toContain(`useCaseAsset("${clip}.webm")`);
      expect(page).toContain(`useCaseAsset("${clip}-poster.jpg")`);
    }
    expect(page).not.toContain("/videos/lasso-claude.mp4");
    expect(page).not.toContain("/videos/find-it.mp4");
    expect(page).toContain("LANDING_BOARD_USE_CASES.map");
    expect(page).toContain(
      'event(viewId.current, "landing.usecase_played", { card, input_mode: inputMode })',
    );
    expect(page).toContain("aria-label={`Play: ${card.title}`}");
    expect(page).not.toContain("            loop\n            playsInline");
    expect(page).toContain('preload="metadata"');
    expect(page).toContain('playIntent.current = "auto"');
    expect(page).toContain('if (playIntent.current === "user") onPlayed(card.key, inputMode.current)');
    expect(page).toContain("new IntersectionObserver");
    expect(page).toContain('(prefers-reduced-motion: reduce)');
  });
  it("places the use cases between the hero and Canvas without card jump controls", () => {
    expect(page.indexOf('className="lb-desktop-hero"')).toBeLessThan(
      page.indexOf("<UseCaseSection onPlayed"),
    );
    expect(page.indexOf("<UseCaseSection onPlayed")).toBeLessThan(
      page.indexOf('className="lb-how-it-works"'),
    );
    expect(page).toContain("WHAT LASSO DOES");
    expect(page).toContain("Three things a buyer asks for. Here is what each looks like.");
    expect(page).not.toContain("See it in the story");
    expect(page).not.toContain("onClick={() => onJump(card.step)}");
    expect(page).toContain("Connect every tool over MCP.");
    expect(page).toContain("All your work becomes context.");
    expect(page).toContain("Every AI conversation, searchable.");
    expect(page).toContain("All your work tools and AI chats, connected once.");
    expect(page).toContain(
      "Ask about the whole process, from research in ChatGPT to the final deck.",
    );
    expect(page).toContain("One view of the chats that mattered, so you can find them later.");
    expect(page).toContain("Watch one engagement, start to finish.");
  });
  it("maps every board tool to an official asset or Simple Icons path", () => {
    const logo = readFileSync("src/components/marketing/ToolLogo.tsx", "utf8");
    for (const mark of ["siClaude", "siGooglegemini", "siGoogledrive", "siGmail"])
      expect(logo).toContain(mark);
    for (const tool of ["claude", "chatgpt", "gemini", "googledrive", "gmail", "powerpoint"])
      expect(logo).toContain(`${tool}:`);
    expect(logo).toContain('key === "powerpoint"');
    expect(logo).toContain("compact ? label : label.toUpperCase()");
    const tools = page.slice(
      page.indexOf("const TOOL_BADGES"),
      page.indexOf("] as const;", page.indexOf("const TOOL_BADGES")),
    );
    expect(tools).not.toContain("<svg");
  });
  it("allowlists every landing event dimension", () => {
    expect(EVENT_DIM_KEYS["landing.section_jumped"]).toEqual(["section"]);
    expect(EVENT_DIM_KEYS["landing.proof_link_opened"]).toEqual(["step", "target"]);
    expect(LANDING_SEE_IT_WORK_LOCATIONS).toEqual(["hero", "hero_workboard"]);
    expect(LANDING_VIEW_SURFACES).toContain("landing-classic");
    expect(
      guardEventDims("landing.story_section_viewed", {
        section: "ask",
        input_mode: "jump",
        content: "no",
      }).dims,
    ).toEqual({ section: "ask", input_mode: "jump" });
    expect(guardEventDims("landing.pilot_cta_clicked", { placement: "header" }).dims).toEqual({
      placement: "header",
    });
  });
  it("derives every proof figure from turns 2, 4, and 6", () => {
    const proof = parseLandingProof({
      itemId: "public-item",
      title: "Partnership scenarios: year-two net benefit",
      vendor: "claude",
      turns: [
        {
          turn_no: 2,
          role: "assistant",
          ts: "2026-08-28T23:07:00Z",
          content:
            "Working from the FY25 audited statements you shared and the Meridian cost sheet from the 14 August call: Scenario A, marketing affiliation with Northgate. Year-two net benefit about $0.3M. Scenario B, shared services with Meridian. Combined back-office savings of $2.1M in year two, less $0.7M of transition cost. Net $1.4M in year two. Scenario C, full merger with Meridian. Net about $1.2M in year two.",
        },
        {
          turn_no: 4,
          role: "assistant",
          ts: null,
          content:
            "Four lines from the Meridian cost sheet, each matched to YellowSigil's FY25 actuals: finance and accounting $0.6M, HR and benefits administration $0.4M, IT and licensing $0.7M, revenue cycle $0.4M. Total $2.1M.",
        },
        {
          turn_no: 6,
          role: "assistant",
          ts: null,
          content:
            "Note under the chart: revenue cycle savings ($0.4M) depend on Meridian's vendor contract extending to YellowSigil volumes; unconfirmed as of 14 August.",
        },
      ],
    });
    expect(proof).toMatchObject({
      scenarioA: 0.3,
      scenarioB: 1.4,
      scenarioC: 1.2,
      savings: 2.1,
      transition: 0.7,
    });
    expect(proof?.lines.map((line) => line.amount)).toEqual([0.6, 0.4, 0.7, 0.4]);
  });
  it("keeps the proof link, source connector, honest wording, and phone gutters", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).toContain("search={{ item: proof.itemId, turn: 4, from: returnTo }}");
    expect(page).toContain("lb-proof-connector");
    expect(page).toContain("sourceRef");
    expect(page.toLowerCase()).not.toContain("verified by lasso");
    expect(css).toContain("translate(-65%, -58%) scale(.66)");
    expect(css).toContain(".lb-caption-stack,.lb-sticky-stage:has");
  });
  it("renders the full decision chat at step seven with one marked turn", () => {
    expect(page).toContain('data-testid="landing-decision-transcript"');
    expect(page).toContain("turns.map((turn)");
    expect(page).toContain('data-decision={turn.turn_no === 5 ? "true" : undefined}');
    expect(page).toContain('turn: 5, from: "story"');
    expect(page).toContain('step: "7", target: "turn"');
    expect(page).toContain("const shownPositions = step === 5 ? [1] : step === 6 ? [2]");
    expect(page).toContain("const showProof = step === 5");
    expect(page).toContain("<strong>The decision</strong>");
    expect(page).toContain('testId="landing-answer-turn-link"');
    expect(page).toContain(
      "onOpenTurn={step === 6 && position === 2 ? onOpenDecisionTurn : undefined}",
    );
    expect(page).toContain('target: "turn"');
  });
  it("uses the approved plain-language story titles", () => {
    for (const old of [
      "Your firm's thinking went invisible.",
      "A number worth asking about.",
      "Every number in the deck has a trail.",
      "Hand-check the actual chat.",
      "And what's still open, pinned where it came from.",
      "Your turn.",
    ])
      expect(page).not.toContain(old);
    for (const title of [
      "Your team's AI work is scattered.",
      "Every AI conversation and every work tool, in one organized place.",
      "Group the work by workstream.",
      "See everything that went into the deck.",
      "Pick any number in the deck.",
      "Ask where a number came from.",
      "Open the conversation it came from.",
      "Add your own notes.",
      "Share the work with the context attached.",
      "Open the board yourself.",
    ])
      expect(page).toContain(title);
    expect(page).toContain(
      "Claude, ChatGPT, Gemini, Drive and the rest land on one board, grouped by the work they belong to.",
    );
  });
  it("keeps the proof compact, proportional, capitalized, and connector-isolated", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).toContain("(line.amount / model.savings) * 100");
    expect(page).toMatch(/step === 4\s*\? \(\s*<svg className="lb-circle-link"/);
    expect(page).toContain('thread.scrollTo({ top: proofCard.offsetTop, behavior: "auto" })');
    expect(page).toContain(
      'const showProof = step === 5 && replay.phase === "done" && proof && proofModel',
    );
    const parser = readFileSync("src/lib/landing-proof-shared.ts", "utf8");
    expect(parser).toContain(
      'replace(/^unconfirmed/i, "Unconfirmed").replace("14 August", "14 Aug")',
    );
    expect(css).toContain(".lb-proof-card h4 strong { font-size: 40px;");
    expect(css).toContain("background: color-mix(in srgb, var(--nb-lasso-green) 8%, transparent)");
  });
  it("shows the proof connector on story steps 6 to 8, but not step 5", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).toMatch(
      /step >= 5 && step <= 7\s*\? \(\s*<path\s*data-testid="landing-proof-connector"/,
    );
    expect(page).not.toContain('step === 4 ? <path data-testid="landing-proof-connector"');
    expect(css).toContain(
      '.lb-stage-window:is([data-step="6"],[data-step="7"],[data-step="8"]) .lb-connectors { opacity: 1; }',
    );
    expect(css).toContain(
      ".lb-proof-connector { stroke: var(--nb-lasso-green); stroke-width: 1.5; stroke-dasharray: 6 4; }",
    );
  });
  it("keeps representative board work inside the public allowlist", () => {
    const [item] = publicSafeWork([
      {
        id: "w1",
        title: "Deck",
        type: "deck",
        source: "upload",
        visibility: "mapped",
        captured_at: "2026-09-25",
        content_ref: "storage/private",
        owner_id: "person",
        work_item_tasks: [],
      },
    ]);
    expect(item).toMatchObject({ id: "w1", title: "Deck", type: "deck" });
    expect(item).not.toHaveProperty("content_ref");
    expect(item).not.toHaveProperty("owner_id");
  });
  it("uses product labels, a single deliverable, and citation-aware pins", () => {
    expect(page).toContain("<VendorMark item={item} />");
    expect(page).toContain("keptContentLabel(item, turnCount)");
    expect(page).toContain("board.turns[item.id]?.length");
    expect(page).toContain("item.id !== deckItem?.id");
    expect(page).toContain("citedIds.has(item.id)");
    expect(page).toContain('className="lb-read-dot"');
  });
  it("keeps the active caption visible and locks jump state", () => {
    expect(page).toContain("step={settledStep}");
    expect(page).toContain("data-step={index + 1}");
    expect(page).toContain("if (jumpTarget.current !== null) return;");
    expect(page).toContain('activate(index, "jump", true)');
  });
  it("offsets only visible story numbering after the cue removal", () => {
    expect(page.match(/const displayStep = index;/g)).toHaveLength(2);
    expect(page.match(/<span>\{displayStep\}<\/span>/g)).toHaveLength(2);
    expect(page).toContain('closing ? item.label : `${displayStep} of ${LANDING_BOARD_STEPS.length}`');
    expect(page.match(/const closing = item\.key === "try-it";/g)).toHaveLength(2);
    expect(page.match(/\{closing \? null : \(/g)).toHaveLength(2);
    expect(page).toContain('event(viewId.current, "landing.story_section_viewed", {');
    expect(page).toContain('event(viewId.current, "landing.section_jumped", { section: key })');
    expect(page).toContain("section: key,");
  });
  it("keeps the closing card numbered-free on both breakpoints", () => {
    expect(page).toContain('key: "try-it"');
    expect(page).toContain('onPilot={() => pilot("try_it")}');
  });
  it("renders inert recorded hero assemblies without emitting play telemetry", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).toContain('poster="/videos/landing-hero-assemble-poster.png"');
    expect(page).toContain('poster="/videos/landing-hero-assemble-phone-poster.png"');
    // S2 adds the self-contained workstreams clip: metadata-only and inline, never autoPlay.
    expect(page.match(/preload="metadata"/g)).toHaveLength(4);
    expect(page.match(/autoPlay/g)).toHaveLength(2);
    expect(page.match(/playsInline/g)).toHaveLength(4);
    expect(page).toContain("<HeroAssemble paused={heroFocus === 1} />");
    expect(page).toContain('(prefers-reduced-motion: reduce)');
    expect(page).not.toContain("HERO_ASSEMBLE_FRAMES");
    expect(page).not.toContain("PHONE_HERO_ASSEMBLE_FRAMES");
    expect(css).not.toContain("@keyframes lb-hero-frame-scattered");
    expect(css).not.toContain("lb-hero-assemble-frame");
  });
  it("keeps the step-one hero on a clean background", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain('.lb-stage-window[data-step="1"] .lb-board-layer { opacity: 0;');
    expect(css).toContain('.lb-stage-window[data-step="1"] .lb-board-card { opacity: 0; }');
  });
  it("uses a separate phone-first eleven-stop story", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).toContain('className="lb-phone-story"');
    expect(page).toContain("data-phone-step={stop}");
    expect(page).toContain('id="lb-phone-usecases"');
    expect(page).toContain("<PhoneHeroAssemble />");
    expect(page).toContain('src="/videos/landing-hero-assemble-phone.webm"');
    expect(page).toContain('src="/videos/landing-hero-assemble-phone.mp4"');
    expect(page).not.toContain("PHONE_HERO_ASSEMBLE_CARDS");
    expect(page).toContain("new IntersectionObserver");
    expect(page).toContain("threshold: 0.6");
    expect(page).toContain(
      "<ExactTurn board={board} preset={second} onOpenTurn={onOpenDecisionTurn} phone />",
    );
    expect(css).toContain("scroll-snap-type: y mandatory");
    expect(css).toContain("padding: 12px 12px calc(72px + env(safe-area-inset-bottom, 0px));");
    expect(css).toContain("scroll-margin-top: calc(var(--lb-header-h) + env(safe-area-inset-top, 0px))");
    expect(page).toMatch(/surface: "landing-board",\s*input_mode:/);
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
    expect(page).toContain("lassoBox && step >= 4 && attentionStep === step");
    expect(page).toContain('pathLength="1"');
    expect(page).toContain("Confirm the vendor extension assumption.");
    expect(page).toContain("Confirm approval by Oct 1.");
  });
  it("uses one settled spotlight on the deck, Ask panel, and decision turn", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).toMatch(
      /step === 4\s*\? "deck"\s*: step === 5\s*\? "ask"\s*: step === 6\s*\? "turn"/,
    );
    expect(page).toContain('data-testid="landing-story-spotlight"');
    expect(css).toContain("backdrop-filter: blur(3px)");
    expect(css).toContain("color-mix(in srgb, var(--nb-ink) 30%, transparent)");
    expect(css).toContain("lb-spotlight-in 300ms");
  });
  it("derives every deck figure and waterfall bar from proof, with a figure-free null state", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).not.toContain("[0.3, 1.4, 1.2]");
    expect(page).not.toContain('data-units="0.7"');
    expect(page).toContain("proof ? [proof.scenarioA, proof.scenarioB, proof.scenarioC] : null");
    expect(page).toContain("const net = proof ? proof.scenarioB : null");
    expect(page).toContain('"--lb-waterfall-units": proof.savings');
    expect(page).toContain('"--lb-waterfall-units": proof.transition');
    expect(page).toContain('"--lb-waterfall-units": proof.scenarioB');
    expect(page).toContain('data-testid="landing-board-number"');
    expect(page).toContain('transition cost equals ${figure(proof.scenarioB)}');
    expect(page).toContain('"Year-two net benefit figures unavailable"');
    expect(page).toContain('className="lb-waterfall-costs"');
    expect(css).toContain("height: calc(var(--lb-waterfall-units) * var(--lb-waterfall-unit))");
    expect(css).toContain("--lb-waterfall-unit: 20px");
    expect(css).toContain("--lb-waterfall-unit: 41.9px");
    const costsBackground = css
      .match(/\.lb-waterfall-costs i \{[^}]*background: ([^;]+);/)?.[1]
      ?.trim();
    expect(costsBackground).toBe("var(--nb-ink-ember)");
    expect(costsBackground).not.toBe("transparent");
  });
  it("sources the Ask client and engagement labels rather than inventing a client name", () => {
    expect(page).toContain("<h3>{clientLabel}</h3>");
    expect(page).toContain("{engagementTitle}");
    expect(page).toContain('clientLabel={result.engagement.clientLabel ?? ""}');
    expect(page).toContain("engagementTitle={result.engagement.title}");
    expect(page).not.toContain("YellowSigil Mobility");
  });
  it("measures the number after transforms and keeps Ask out of the page scroll path", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).toContain("getBoundingClientRect()");
    expect(page).toContain('event.propertyName === "transform"');
    expect(page).toContain("boxesMatch(current, next)");
    expect(page).toContain("boxesMatch(current, nextLassoBox)");
    expect(page).toContain("[data-testid=landing-proof-card]");
    expect(page).toContain("measureFrameRef.current = window.requestAnimationFrame(tick)");
    expect(page).toContain("sourceRect.width <= 0 || sourceRect.height <= 0");
    expect(page).toContain("layerRect.width / layer.offsetWidth");
    expect(page).toContain("thread.scrollTo");
    expect(css).toContain(".lb-replay-thread { min-height: 0; flex: 1; overflow: hidden;");
    expect(page).toContain('data-story-scroll="locked"');
  });
  it("announces and animates only settled captions with a reduced-motion answer", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).toContain('aria-live={phase === "incoming" ? "polite" : undefined}');
    expect(page).toContain("setAttentionNonce");
    expect(page).toContain("data-phase={phase}");
    expect(css).toContain("lb-caption-in 360ms");
    expect(css).toContain("lb-caption-out 160ms");
    expect(css).toContain("var(--lb-word-index) * 40ms");
    expect(css).toContain("lb-caption-crossfade 150ms");
    expect(css).toContain("lb-target-ring 600ms");
  });
});
