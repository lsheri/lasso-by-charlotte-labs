// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({}) } }));

import { ContinueInAI } from "@/components/canvas-lab/ask-draft/ContinueInAI";
import { BRANCH_URL_LIMIT } from "@/lib/branch-targets";
import {
  H7_CHOICES,
  H7_FILE_LIMIT,
  handoffLine,
  handoffLineFits,
  handoffRoute,
  packageHandoff,
  pickHandoffTool,
  toolFromVendor,
} from "@/lib/ask-handoff";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

const none = { boardPushes: [], myPushes: [], connected: [], asked: null };

describe("H7 the AI is worked out from pushes", () => {
  it("reads vendors and client names as one of the three AIs", () => {
    expect(toolFromVendor("claude")).toBe("claude");
    expect(toolFromVendor("Claude (claude.ai)")).toBe("claude");
    expect(toolFromVendor("openai")).toBe("chatgpt");
    expect(toolFromVendor("ChatGPT")).toBe("chatgpt");
    expect(toolFromVendor("gemini")).toBe("gemini");
    expect(toolFromVendor(null)).toBeNull();
    expect(toolFromVendor("cursor")).toBeNull();
  });
  it("order: last push to this board, else most-pushed, else the only connected AI, else the answer given once, else ask", () => {
    expect(
      pickHandoffTool({
        ...none,
        boardPushes: [
          { vendor: "claude", at: "2026-11-01" },
          { vendor: "openai", at: "2026-11-07" },
        ],
        myPushes: [{ vendor: "claude" }, { vendor: "claude" }],
      }),
    ).toBe("chatgpt");
    expect(
      pickHandoffTool({
        ...none,
        myPushes: [{ vendor: "claude" }, { vendor: "openai" }, { vendor: "openai" }],
        connected: ["Claude"],
      }),
    ).toBe("chatgpt");
    expect(pickHandoffTool({ ...none, connected: ["Gemini"] })).toBe("gemini");
    expect(pickHandoffTool({ ...none, connected: ["Claude", "ChatGPT"], asked: "chatgpt" })).toBe(
      "chatgpt",
    );
    expect(pickHandoffTool({ ...none, connected: ["Claude", "ChatGPT"] })).toBeNull();
    expect(pickHandoffTool(none)).toBeNull();
  });
  it("a tie in pushes falls to the catalogue order, so the pick is stable", () => {
    expect(
      pickHandoffTool({ ...none, myPushes: [{ vendor: "openai" }, { vendor: "claude" }] }),
    ).toBe("claude");
  });
});

describe("H7 nothing is put together until the person continues", () => {
  it("rendering the button and opening the menu builds nothing", () => {
    const build = vi.fn(() => ({ boardTitle: "D8", messages: [], used: [], board: [] }));
    render(
      <ContinueInAI
        profileId="p"
        disabled={false}
        signals={{
          boardPushes: [{ vendor: "claude", at: "x" }],
          myPushes: [],
          connected: [],
          signin: false,
        }}
        build={build}
        onDone={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue in Claude" }));
    expect(screen.getByTestId("continue-menu")).toBeTruthy();
    expect(build).not.toHaveBeenCalled();
  });
  it("one click on a choice builds once and opens the AI", async () => {
    const build = vi.fn(() => ({
      boardTitle: "D8",
      messages: [
        { role: "user", content: "q" },
        { role: "assistant", content: "a" },
      ],
      used: [],
      board: [],
    }));
    const open = vi.spyOn(window, "open").mockReturnValue({} as Window);
    const onDone = vi.fn();
    render(
      <ContinueInAI
        profileId="p"
        disabled={false}
        signals={{
          boardPushes: [{ vendor: "claude", at: "x" }],
          myPushes: [],
          connected: [],
          signin: false,
        }}
        build={build}
        onDone={onDone}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue in Claude" }));
    expect(screen.getAllByRole("menuitem").map((b) => b.textContent)).toEqual(
      H7_CHOICES.map((c) => c.label),
    );
    expect(screen.getAllByRole("menuitem")[0]!.getAttribute("data-default")).toBe("true");
    fireEvent.click(screen.getAllByRole("menuitem")[0]!);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("link", false, "Claude"));
    expect(build).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]![0]).toMatch(/^https:\/\/claude\.ai\/new\?q=/);
  });
  it("with no signal it asks once, then remembers the answer for this person", () => {
    render(
      <ContinueInAI
        profileId="p1"
        disabled={false}
        signals={{ boardPushes: [], myPushes: [], connected: [], signin: false }}
        build={vi.fn()}
        onDone={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue in your AI" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Gemini/ }));
    expect(screen.getAllByRole("menuitem").map((b) => b.textContent)).toEqual(
      H7_CHOICES.map((c) => c.label),
    );
    cleanup();
    render(
      <ContinueInAI
        profileId="p1"
        disabled={false}
        signals={{ boardPushes: [], myPushes: [], connected: [], signin: false }}
        build={vi.fn()}
        onDone={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Continue in Gemini" })).toBeTruthy();
  });
});

describe("H7 what goes, and how", () => {
  const base = {
    boardTitle: "D8 Plan",
    messages: [
      { role: "user", content: "Plan the next week" },
      { role: "assistant", content: "Here is the plan." },
    ],
    used: [{ title: "Kickoff call", kind: "transcript" }],
    board: [
      { title: "Kickoff call", kind: "transcript" },
      { title: "Pricing deck", kind: "deck" },
    ],
    viaConnector: false,
  };
  it("the default carries the chat and what it used", () => {
    const text = packageHandoff({ ...base, choice: "chat_and_used" });
    expect(text).toContain("You: Plan the next week");
    expect(text).toContain("- Kickoff call (transcript)");
  });
  it("what this answer used carries the answer, not the whole chat", () => {
    const text = packageHandoff({ ...base, choice: "answer_used" });
    expect(text).toContain("Here is the plan.");
    expect(text).not.toContain("You: Plan the next week");
  });
  it("the full board lists every piece; with a connector the AI is told to read them through Lasso", () => {
    const text = packageHandoff({ ...base, choice: "full_board", viaConnector: true });
    expect(text).toContain("- Pricing deck (deck)");
    expect(text).toContain("Use the Lasso connector");
  });
  it("routes: connector, filled-in link, clipboard, or file", () => {
    expect(handoffRoute("claude", "short", true).route).toBe("connector");
    expect(handoffRoute("claude", "short", false).route).toBe("link");
    expect(handoffRoute("claude", "x".repeat(BRANCH_URL_LIMIT), false).route).toBe("clipboard");
    expect(handoffRoute("gemini", "short", false).route).toBe("clipboard");
    expect(handoffRoute("chatgpt", "x".repeat(H7_FILE_LIMIT + 1), false).route).toBe("file");
  });
  it("plain words only: never cost, never a comparison with their AI", () => {
    const src = ["src/lib/ask-handoff.ts", "src/components/canvas-lab/ask-draft/ContinueInAI.tsx"]
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    const strings = src.match(/(["'`])(?:(?!\1).)*\1/g)?.join(" ") ?? "";
    expect(strings).not.toMatch(/\bcost|\bprice|\btokens?\b|\bcredits?\b|better than|smarter/i);
  });
});

describe("H7 the line under an answer", () => {
  it("only for research, drafting and planning questions", () => {
    expect(handoffLineFits("Can you research competitors in this space?")).toBe(true);
    expect(handoffLineFits("Draft the client email")).toBe(true);
    expect(handoffLineFits("What are the next steps?")).toBe(true);
    expect(handoffLineFits("What did we decide on pricing?")).toBe(false);
    expect(handoffLineFits("Who joined the kickoff call?")).toBe(false);
  });
  it("names the AI and what the answer used", () => {
    expect(handoffLine("claude", "used 4 transcripts")).toBe(
      "Continue in Claude with this chat and the 4 transcripts it used.",
    );
    expect(handoffLine("chatgpt", null)).toBe("Continue in ChatGPT with this chat.");
  });
});

describe("H7b fits the panel", () => {
  it("the menu sits over the page, not inside the clipped panel, and a choice inside it still works", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue({} as Window);
    const onDone = vi.fn();
    render(<div style={{ overflow: "hidden" }}><ContinueInAI profileId="p" disabled={false} signals={{ boardPushes: [{ vendor: "claude", at: "x" }], myPushes: [], connected: [], signin: false }} build={() => ({ boardTitle: "B", messages: [], used: [], board: [] })} onDone={onDone} /></div>);
    fireEvent.click(screen.getByRole("button", { name: "Continue in Claude" }));
    const menu = await screen.findByTestId("continue-menu");
    expect(menu.parentElement).toBe(document.body);
    expect(menu.style.position).toBe("fixed");
    fireEvent.pointerDown(screen.getAllByRole("menuitem")[1]!);
    fireEvent.click(screen.getAllByRole("menuitem")[1]!);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(open).toHaveBeenCalledTimes(1);
  });
  it("the line under an answer wraps inside the panel", () => {
    const src = readFileSync("src/components/canvas-lab/ask-draft/AskDraftSurface.tsx", "utf8");
    expect(src).toMatch(/data-testid="h7-line">\s*<Button[^>]*className="[^"]*whitespace-normal[^"]*"/);
  });
});

describe("H7 behind the flag, events unchanged", () => {
  it("the Ask surface only reaches H7 through ask-v2, and still emits handoff_opened", () => {
    const src = readFileSync("src/components/canvas-lab/ask-draft/AskDraftSurface.tsx", "utf8");
    expect(src).toMatch(/draft === "b" && askV2 \? \(\s*<ContinueInAI/);
    expect(src).toMatch(/draft === "b" && !askV2 && props\.tab === "messages" && shouldNudge/);
    expect(src).toMatch(/useHandoffSignals\(\{[^}]*enabled: askV2 \}\)/);
    expect(
      src.match(/noteWorkboardAskView\(props\.orgId, "handoff_opened", draft\)/g)?.length,
    ).toBe(2);
  });
});
