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
    expect(page).toContain("IntersectionObserver");
    expect(page).toContain("scrollIntoView");
    expect(page).toContain('jumpTarget.current = index');
    expect(page).toContain('behavior: "auto"');
    const steps = page.slice(page.indexOf("export const LANDING_BOARD_STEPS"), page.indexOf("] as const;"));
    expect(steps.match(/key: "/g)).toHaveLength(10);
  });
  it("has a reduced-motion jump path", () => {
    expect(page).toContain('prefers-reduced-motion: reduce');
    expect(page).toContain('scroll-behavior: auto !important');
  });
  it("contains no write controls", () => {
    for (const copy of ["Delete", "Share link", "Add work", "Comment", "Push to"]) expect(page).not.toContain(copy);
  });
  it("uses an asset image or text fallback for every tool identity", () => {
    expect(page).toContain("claudeLogo.url");
    expect(page).toContain("known?.logo ? <img");
    expect(page).toContain("<span>{compact ? label : label.toUpperCase()}</span>");
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
    expect(page).toContain('item.id !== deckItem?.id');
    expect(page).toContain('citedIds.has(item.id)');
    expect(page).toContain('className="lb-read-dot"');
  });
  it("hides the redundant first caption and locks jump state", () => {
    expect(page).toContain('{index === 0 ? null : <article className="lb-caption">');
    expect(page).toContain('if (jumpTarget.current !== null) return;');
    expect(page).toContain('input_mode: "jump"');
  });
});