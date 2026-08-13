import { describe, expect, it } from "vitest";

import { parseThread } from "@/lib/parse-thread";

describe("parseThread", () => {
  it("splits bare 'You:' and 'ChatGPT:' markers into turns", () => {
    const raw = "You: What should we price?\nChatGPT: Start at cost plus 20%.\nYou: Why?";
    const { turns, resolved } = parseThread(raw);
    expect(resolved).toBe(true);
    expect(turns).toHaveLength(3);
    expect(turns.map((t) => t.role)).toEqual(["user", "assistant", "user"]);
    expect(turns[0]?.content).toBe("What should we price?");
    expect(turns[1]?.content).toBe("Start at cost plus 20%.");
    expect(turns[2]?.content).toBe("Why?");
  });

  it("does not split on a mid-sentence 'you:'", () => {
    const raw = "You: I told you: this is the plan.";
    const { turns, resolved } = parseThread(raw);
    expect(resolved).toBe(false);
    expect(turns).toHaveLength(1);
    expect(turns[0]?.role).toBe("user");
    expect(turns[0]?.content).toBe("You: I told you: this is the plan.");
  });

  it("is case-insensitive for bare markers", () => {
    const raw = "chatgpt: one\nYOU: two\nChatGPT: three";
    const { turns, resolved } = parseThread(raw);
    expect(resolved).toBe(true);
    expect(turns.map((t) => t.role)).toEqual(["assistant", "user", "assistant"]);
  });
});
