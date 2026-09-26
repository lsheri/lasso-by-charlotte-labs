import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const board = readFileSync("src/components/demo/DemoWorkboardSandbox.tsx", "utf8");
const pages = readFileSync("src/pages/DemoPages.tsx", "utf8");
const landing = readFileSync("src/components/marketing/B2BLanding.tsx", "utf8");
const story = readFileSync("src/components/marketing/LandingBoard.tsx", "utf8");

describe("Unit P1 playable finished board", () => {
  it("opens the finished proof state and keeps the classic demo", () => {
    expect(pages).toContain("<DemoWorkboardSandbox");
    expect(board).toContain('presets.find((entry) => entry.position === 1)?.position');
    expect(board).toContain("<PlaygroundProofCard");
    expect(readFileSync("src/routes/demo.classic.tsx", "utf8")).toContain('createFileRoute("/demo/classic")');
  });

  it("routes public demo entrances to the playground", () => {
    expect(landing).toContain('void navigate({ to: "/demo" })');
    expect(story).toContain('<Link to="/demo">Open the board yourself</Link>');
  });

  it("returns every story link to the real home page", () => {
    expect(board).toContain('<Link to="/" hash="lb-try-it">Back to the story</Link>');
    expect(readFileSync("src/pages/DemoExtraPages.tsx", "utf8")).toContain('navigate({ to: "/", hash: "lb-ask" })');
  });

  it("keeps all play state local and schedules the requested reset", () => {
    expect(board).toContain("const [frames, setFrames] = useState");
    expect(board).toContain("const [nodes, setNodes] = useState");
    expect(board).toContain("Date.now() + 5_000");
    expect(board).toContain("window.setTimeout(() => resetBoard(true), 5_000)");
    expect(board).toContain("setFrames(initial.frames)");
    expect(board).toContain("setNodes(initial.nodes)");
    expect(board).toContain("setActiveSlide(2)");
    expect(board).not.toMatch(/localStorage|sessionStorage|useMutation/);
  });

  it("pauses reset during gestures and sticky editing", () => {
    expect(board).toContain("if (!resetAt || drag || resize || editing) return");
    expect(board).toContain("clearTimer(); setEditing(true)");
    expect(board).toContain("setEditing(false); scheduleReset()");
  });

  it("uses the engagement workboard components through a local adapter", () => {
    for (const component of ["LabCard", "LabFrameElement", "LabSticky", "LabRelationships", "buildSharedBoardModel"]) expect(board).toContain(component);
    expect(board).toContain('data-component="CanvasLabPage"');
    expect(board).toContain('data-component="BoardAsk"');
    expect(board).not.toMatch(/supabase|mutateCanvasLabBoardFn|placeWorkOnBoardFn|fetch\(/);
  });

  it("emits the closed additive vocabulary", () => {
    const telemetry = readFileSync("src/lib/demo-telemetry.ts", "utf8");
    for (const action of ["drag_card", "drag_group", "sticky_added", "sticky_edited", "reset_auto", "reset_manual", "preset_opened", "proof_link_opened", "slide_selected"]) expect(telemetry).toContain(`\"${action}\"`);
  });

  it("contains the deliverable and swaps its six local slide thumbnails", () => {
    expect(board).toContain('className="demo-deliverable-main"');
    expect(board).toContain("Array.from({ length: 6 }");
    expect(board).toContain('emit("slide_selected")');
  });
});