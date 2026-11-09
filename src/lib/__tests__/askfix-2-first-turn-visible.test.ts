import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const surface = readFileSync("src/components/canvas-lab/ask-draft/AskDraftSurface.tsx", "utf8");
const hook = readFileSync("src/components/reflect/use-ask-lasso.ts", "utf8");
const css = readFileSync("src/styles.css", "utf8");

describe("ASK-FIX-2 the first turn is visible while Lasso works", () => {
  it("a question in flight is not an empty chat, so the thread is not folded away", () => {
    expect(surface).toMatch(/const empty = props\.tab === "messages" && \(ask\.messages \?\? \[\]\)\.length === 0 && !ask\.pending;/);
    expect(surface).toMatch(/const collapsed = empty \|\| folded;/);
    // The fold that hid it: a collapsed Ask hides the thread entirely.
    expect(css).toMatch(/\.ask-draft\[data-collapsed="true"\] \.ask-draft-body > \.nb-binder \{ display: none; \}/);
  });
  it("the idle bar still needs no question in flight", () => {
    expect(surface).toMatch(/const idleBar = askV2 && empty && !ask\.pending/);
  });
  it("sending unfolds a folded Ask", () => {
    expect(surface).toMatch(/useEffect\(\(\) => \{ if \(ask\.pending\) setFolded\(false\); \}, \[ask\.pending\]\);/);
  });
});

describe("ASK-FIX-2 a follow-up scrolls to the new turn", () => {
  const effect = hook.slice(hook.indexOf("// ASK-FIX-2: scroll"), hook.indexOf("async function ensureSession"));
  it("waits for the panel to grow, then scrolls to the end", () => {
    expect(effect).toMatch(/raf\(\(\) => \{ frame = raf\(\(\) => bottomRef\.current\?\.scrollIntoView\(\{ behavior: "smooth", block: "end" \}\)\); \}\)/);
  });
  it("scrolls again when the read set arrives, never on every streamed word", () => {
    expect(effect).toMatch(/\[pending, asked, liveManifest\]/);
    expect(hook).toContain("}, [messages?.length, pending, asked]);");
    expect(effect).not.toMatch(/streamed/);
  });
});
