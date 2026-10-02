import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EVENT_DIM_ALLOWLIST } from "@/lib/event-dim-allowlist";

const src = readFileSync(resolve(__dirname, "../mcp-handler.server.ts"), "utf8");

describe("CL-2b attach chat link", () => {
  it("registers the tool with both arguments required", () => {
    expect(src).toContain('name: "lasso_attach_chat_link"');
    expect(src).toContain('required: ["lasso_conversation_id", "chat_url"]');
    expect(src).toContain('if (name === "lasso_attach_chat_link")');
  });

  it("filters both the read and the write by the caller's profile id", () => {
    const body = src.slice(src.indexOf("async function attachChatLink"), src.indexOf("function textResult("));
    expect(body.match(/\.eq\("owner_id", owner\.profileId\)/g)?.length).toBe(2);
    expect(body).toContain("pastedChatUrl(rawUrl)");
    expect(body).toContain("isBareChatOrigin(");
    expect(body).toContain("...((row.meta ?? {}) as Record<string, unknown>), chat_url: url");
  });

  it("asks only when no rung holds, in plain copy", () => {
    const line = " No link back to this chat was recorded. Paste the URL from your address bar and I will attach it with lasso_attach_chat_link.";
    expect(src).toContain(line);
    expect(line).not.toMatch(/\u2014|audit|monitor|track|score/i);
    expect(src).toContain("return link ? \"\" : NO_CHAT_LINK_LINE;");
  });

  it("allows the new event's dims", () => {
    expect((EVENT_DIM_ALLOWLIST as Record<string, string[]>)["mcp.chat_link_attached"]).toEqual(["had_prior_link", "source"]);
  });
});
