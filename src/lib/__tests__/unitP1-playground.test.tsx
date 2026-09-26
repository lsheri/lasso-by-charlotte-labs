import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const board = readFileSync("src/components/marketing/LandingBoard.tsx", "utf8");
const pages = readFileSync("src/pages/DemoPages.tsx", "utf8");
const landing = readFileSync("src/components/marketing/B2BLanding.tsx", "utf8");
const story = readFileSync("src/components/marketing/LandingBoard.tsx", "utf8");

describe("Unit P1 playable finished board", () => {
  it("opens the finished proof state and keeps the classic demo", () => {
    expect(pages).toContain("<PlayableDemoBoard");
    expect(board).toContain('presets.find((entry) => entry.position === 1)?.position');
    expect(board).toContain("showProof ? <ProofCard");
    expect(readFileSync("src/routes/demo.classic.tsx", "utf8")).toContain('createFileRoute("/demo/classic")');
  });

  it("routes public demo entrances to the playground", () => {
    expect(landing).toContain('void navigate({ to: "/demo" })');
    expect(story).toContain('<Link to="/demo">Open the board yourself</Link>');
  });

  it("returns every story link to the real home page", () => {
    expect(pages).toContain('<Link to="/" hash="lb-try-it">Back to the story</Link>');
    expect(readFileSync("src/pages/DemoExtraPages.tsx", "utf8")).toContain('navigate({ to: "/", hash: "lb-ask" })');
  });

  it("keeps all play state local and schedules the requested reset", () => {
    expect(board).toContain("const [offsets, setOffsets] = useState");
    expect(board).toContain("const [stickies, setStickies] = useState");
    expect(board).toContain("Date.now() + 5_000");
    expect(board).toContain("window.setTimeout(() => resetBoard(true), 5_000)");
    expect(board).toContain("setOffsets({})");
    expect(board).toContain("setStickies([])");
    expect(board).not.toMatch(/localStorage|sessionStorage|useMutation/);
  });

  it("pauses reset during gestures and sticky editing", () => {
    expect(board).toContain("if (!resetAt || drag || editing) return");
    expect(board).toContain("clearResetTimer(); setEditing(true)");
    expect(board).toContain("setEditing(false); emit(\"sticky_edited\"); scheduleReset()");
  });

  it("emits the closed additive vocabulary", () => {
    for (const action of ["drag_card", "drag_group", "sticky_added", "sticky_edited", "reset_auto", "reset_manual", "preset_opened", "proof_link_opened"]) expect(board).toContain(`\"${action}\"`);
  });
});