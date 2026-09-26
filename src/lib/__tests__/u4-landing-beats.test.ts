import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/components/marketing/B2BLanding.tsx", "utf8");
const hero = readFileSync("src/components/marketing/HeroMotion.tsx", "utf8");
const beats = readFileSync("src/components/marketing/BeatSnapshots.tsx", "utf8");

function visibleCopy(src: string) {
  return src
    .replace(/^import .*$/gm, "")
    .replace(/className=(?:"[^"]*"|\{`[^`]*`\})/g, "")
    .replace(/\/\/.*$/gm, "")
    .toLowerCase();
}

describe("Unit 4 public page", () => {
  it("keeps the four original anonymous events and adds the story-section event", () => {
    for (const name of ["landing.viewed", "landing.pilot_cta_clicked", "landing.see_it_work_clicked", "landing.pilot_requested", "landing.story_section_viewed"]) {
      expect(page).toContain(`event_type: "${name}"`);
    }
    expect(page).toContain('dims: { variant: "b2b", surface }');
    expect(page).toContain("dims: { team_size: teamSize }");
  });

  it("carries the hero H1 and the beats anchor", () => {
    expect(page).toContain("Your firm bought AI. The human judgment, process, and thinking in your team's work went invisible.");
    expect(page).toContain('<a href="/demo" onClick={openDemoWorkspace}>');
    expect(page).toContain('id="beats"');
  });

  it("has no em dash and no banned words", () => {
    for (const src of [page, hero, beats]) {
      expect(src).not.toContain("\u2014");
      const copy = visibleCopy(src);
      for (const word of ["track", "monitor", "watch", "caught", "score", "surveillance", "telemetry", "analytics", "data collection", "oversight", "governance", "compliance"]) {
        expect(copy).not.toMatch(new RegExp(`\\b${word}`, "i"));
      }
    }
  });

  it("keeps component colours token-based", () => {
    expect(beats).not.toContain("requestAnimationFrame");
    expect(hero).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(beats).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  it("uses a six-slide illustrative Harborline deck and real vendor marks", () => {
    expect(hero).toContain("Illustrative client recommendation");
    expect(hero).toContain("Harborline Health Alliance · Growth partnerships and board structure, FY27");
    expect(hero).toContain("Bridge4 Partners · illustrative · {index + 1} / 6");
    expect(hero).toContain("Slide {step.slide + 1} of 6");
    expect(hero).toContain("Five organizations we benchmarked.");
    expect(hero).toContain("Partnership revenue to $1.4M by FY27.");
    expect(hero).toContain("<VendorMark");
    expect(hero).not.toContain("Riverside Nine");
  });

  it("drives a sticky deck from the step nearest the viewport centre, with no tunnel or doodle", () => {
    expect(hero).toContain("export function DeckWalkthrough");
    expect(hero).toContain("IntersectionObserver");
    expect(hero).toContain('className="lw-step-body"');
    expect(hero).toContain("rect.top + rect.height / 2 - viewportCentre");
    expect(hero).toContain('window.addEventListener("scroll", requestMeasure, { passive: true })');
    expect(hero).toContain("window.requestAnimationFrame(measure)");
    expect(hero).not.toContain('rootMargin: "-50% 0px -50% 0px"');
    expect(hero).toContain("window.setInterval(spawnWord, 260)");
    expect(hero).not.toContain("setTimeout");
    expect(hero).not.toContain("ConversationTunnel");
    expect(hero).not.toContain("landing-story-doodle");
    expect(hero).not.toContain("landing-story-reach-chip");
    expect(hero.match(/<SourceGlyph/g)?.length).toBeGreaterThanOrEqual(1);
    expect(hero).toContain('vendor: "granola"');
    expect(hero).toContain('vendor: "lovable"');
    expect(hero).toContain("What Lasso read");
  });

  it("keeps one question crisp and gives phone scenes room to breathe", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain(".lw-step { min-height: 88vh");
    expect(css).toContain("opacity: .18; filter: blur(5px)");
    expect(css).toContain('.lw-step[data-active="true"] { opacity: 1; filter: none; }');
    expect(css).toContain("min-height: 120svh; padding-block: 18svh");
    expect(css).toContain("opacity: .12; filter: blur(6px)");
    expect(css).toContain(".lw-step { transition: none; }");
  });

  it("makes each incoming question and Lasso answer explicit", () => {
    expect(hero).toContain("Board chair");
    expect(hero).toContain("Client CEO");
    expect(hero).toContain("Manager question");
    expect(hero).toContain("lw-answer");
    expect(page.match(/>HOW IT WORKS</g)).toHaveLength(1);
    expect(page).toContain("Deliverables you can defend to a client, a partner, or a board.");
    expect(page).toContain("Every claim, traced to the work behind it.");
    expect(page).not.toContain("The deliverable stays");
  });
});

describe("Unit 8 story system", () => {
  it("has four steps opening slides 2, 1, 3, 5", () => {
    const slides = Array.from(hero.matchAll(/^    slide: (\d),$/gm), (m) => Number(m[1]));
    expect(slides).toEqual([2, 1, 3, 5]);
    expect(hero).toContain("Open the exact turn · 1");
  });

  it("closes with the pilot line and the shared particle phrase", () => {
    expect(page).toContain("Three months. Your firm's real work. Share what you choose, when you choose: one review pass instead of five, and a record the firm keeps.");
    expect(page).toContain("Three months, one real engagement");
    expect(page).not.toContain("No prompts shown");
    expect(page).not.toMatch(/Four months/i);
    expect(page).toContain("The judgement, thinking, work... *Visible*");
    expect(page).toContain("landing-close-wordmark");
    expect(page).toContain('<LandingParticlePhrase text="The judgement, thinking, work... *Visible*" />');
    expect(page).not.toContain("ParticleReveal");
    expect(page).toContain('notePlacedPilotClick("header")');
    expect(page).toContain('notePlacedPilotClick("close")');
    expect(page).toContain("dims: { placement }");
  });
});

describe("Unit 8 placement dim", () => {
  it("keeps placement on the pilot CTA event", async () => {
    const { guardEventDims } = await import("@/lib/event-dim-allowlist");
    const kept = guardEventDims("landing.pilot_cta_clicked", { placement: "header" }) as Record<string, unknown>;
    expect(kept).toMatchObject({ keep: true, dims: { placement: "header" } });
  });
});

describe("Unit 10 landing", () => {
  it("plays the hero video with both sources, a poster and a reduced-motion play button", () => {
    expect(page).toContain('poster={heroPosterAsset.url}');
    expect(page).toContain('<source src={heroWebmAsset.url} type="video/webm" />');
    expect(page).toContain('<source src={heroMp4Asset.url} type="video/mp4" />');
    expect(page).not.toContain("/videos/lasso-hero-landing-1440");
    expect(page).toContain('aria-label="Play"');
    expect(page).toContain("Illustrative engagement · every figure is made up");
  });

  it("inverts walkthrough emphasis and continuously streams source words into the active highlight", () => {
    expect(hero).toContain('"Manager question": "Question from **Yourself"');
    expect(hero).toContain("lw-role-label");
    expect(hero).toContain("lw-word-stream");
    expect(hero).toContain("lw-flying-word");
    expect(hero).toContain("lw-word-swirl");
    expect(hero).toContain("getBoundingClientRect");
    expect(hero).toContain("animation.finished");
    expect(hero).toContain("inFlight.size >= 16");
    expect(hero).toContain('document.addEventListener("visibilitychange"');
    expect(hero).toContain("sectionObserver.observe(grid)");
  });

  it("resolves use-case clips from asset pointers with public fallbacks", () => {
    expect(page).toContain('import.meta.glob("@/assets/use-*.asset.json", { eager: true })');
    expect(page).toContain('useCaseAssetUrl(`${card.file}.webm`, `/videos/${card.file}.webm`)');
    expect(page).toContain('useCaseAssetUrl(`${card.file}.mp4`, `/videos/${card.file}.mp4`)');
    expect(page).toContain('useCaseAssetUrl(`${card.file}-poster.jpg`, `/videos/${card.file}-poster.jpg`)');
    expect(page).toContain('<source src={webmClip} type="video/webm" />');
    expect(page).toContain('<source src={mp4Clip} type="video/mp4" />');
  });

  it("closes the resolved phrase in neon orange with a matching glow", () => {
    const styles = readFileSync("src/styles.css", "utf8");
    expect(styles).toContain(".landing-close-line2 .landing-particle-word-text");
    expect(styles).toContain("var(--lb-neon-orange)");
    expect(styles).toContain("--lb-neon-orange: #ff5f1f");
    expect(page).not.toContain("landing-close-particles-a");
  });

  it("builds the underlined phrase from particles, then holds it for three seconds", () => {
    const particle = readFileSync("src/components/marketing/LandingParticlePhrase.tsx", "utf8");
    const styles = readFileSync("src/styles.css", "utf8");
    expect(particle).toContain("export const PARTICLE_TEXT_HOLD_MS = 3000");
    expect(particle).toContain("<canvas ref={canvasRef} className=\"landing-particle-word-canvas\" />");
    expect(particle).toContain("if (gathering || dispersing) {");
    expect(styles).toContain(".landing-particle-word-canvas");
  });

  it("has the three ordered use-case cards and fires landing.usecase_played once per card", () => {
    const keys = Array.from(page.matchAll(/\{ key: "([a-z_]+)", file: "use-/g), (match) => match[1]);
    expect(keys).toEqual(["bring_work_in", "reasoning_stays", "every_number"]);
    for (const file of ["use-every-number-has-a-source", "use-reasoning-stays-with-the-firm", "use-bring-work-in"]) {
      expect(page).toContain(`file: "${file}"`);
    }
    for (const removed of ["check_sources", "find_lost_idea", "share_deliverable"]) {
      expect(page).not.toContain(`key: "${removed}"`);
    }
    expect(page).toContain('event_type: "landing.usecase_played"');
    expect(page).toContain("dims: { card, input_mode: inputMode }");
    expect(page).toContain("playedCards.current.has(card)");
  });

  it("replaces the trust row with the sharing section", () => {
    expect(page).toContain('aria-label="Sharing"');
    expect(page).toContain("Share the deliverable, not the drafts.");
    for (const audience of ["Teammates", "Managers", "Clients", "Mentors"]) {
      expect(page).toContain(`label: "${audience}"`);
    }
    expect(page).toContain("Notes are never a source · a shared board is read only · the record is yours");
    expect(page).not.toContain("Notes are never a source.");
    expect(page).not.toContain("landing-trust");
  });

  it("lets the swirl path animation own the visible opacity", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain(".lw-word-swirl { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }");
    expect(css).not.toMatch(/\.lw-word-swirl\s*\{[^}]*opacity/s);
  });
});
