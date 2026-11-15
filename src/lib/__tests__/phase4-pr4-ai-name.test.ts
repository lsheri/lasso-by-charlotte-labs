// Phase 4 PR4: under Charlotte the model's fixed prompts and the hand-off text use her name; Lasso stays byte-identical.
import { describe, expect, it } from "vitest";

import { BRANDS, brandCopy } from "@/design/brand/brand";
import { ANALYSIS_PRESETS } from "@/lib/analysis-presets";
import { packageHandoff, type H7Input } from "@/lib/ask-handoff";
import { serverBrand, skinFromCookieHeader } from "@/lib/brand-server";
import { ANSWER_RULES, CATALOGUE_RULES } from "@/lib/record-answer.server";
import { whereLineFor } from "@/lib/reflect-run.server";

const lasso = BRANDS.lasso;
const charlotte = BRANDS.charlotte;
const noDb = {} as never;

describe("the brand the server speaks as", () => {
  it("honours the skin cookie only for an allowed account (D1)", () => {
    expect(serverBrand("charlotte", "someone@charlotte-labs.com")).toBe(charlotte);
    expect(serverBrand("charlotte", "qa.company.admin@qaprobe.test")).toBe(charlotte);
    expect(serverBrand("charlotte", "pilot@example.com")).toBe(lasso);
    expect(serverBrand("charlotte", null)).toBe(lasso);
    expect(serverBrand("lasso", "someone@charlotte-labs.com")).toBe(lasso);
  });

  it("reads the skin from a raw Cookie header", () => {
    expect(skinFromCookieHeader("a=1; skin=charlotte; b=2")).toBe("charlotte");
    expect(skinFromCookieHeader("skin=lasso")).toBe("lasso");
    expect(skinFromCookieHeader("skins=charlotte")).toBe("lasso");
    expect(skinFromCookieHeader(null)).toBe("lasso");
  });
});

describe("the model's fixed prompts", () => {
  it("leaves every Lasso prompt byte-identical", async () => {
    expect(brandCopy(lasso, CATALOGUE_RULES)).toBe(CATALOGUE_RULES);
    expect(brandCopy(lasso, ANSWER_RULES)).toBe(ANSWER_RULES);
    for (const preset of Object.values(ANALYSIS_PRESETS)) expect(brandCopy(lasso, preset.systemPrompt)).toBe(preset.systemPrompt);
    const whole = { mode: "whole", ids: [] } as never;
    expect(await whereLineFor(noDb, whole)).toBe("WHERE THE PERSON IS: Ask Lasso, across their whole record, with no board open.");
    expect(await whereLineFor(noDb, whole, lasso)).toBe(await whereLineFor(noDb, whole));
  });

  it("names Charlotte, and never Lasso, under Charlotte", async () => {
    const rules = brandCopy(charlotte, CATALOGUE_RULES);
    expect(rules).toContain("Charlotte can:");
    expect(rules).toContain("Charlotte cannot:");
    for (const text of [rules, brandCopy(charlotte, ANSWER_RULES), ...Object.values(ANALYSIS_PRESETS).map((p) => brandCopy(charlotte, p.systemPrompt))]) {
      expect(text).not.toMatch(/Lasso/);
    }
    const where = await whereLineFor(noDb, { mode: "whole", ids: [] } as never, charlotte);
    expect(where).toBe("WHERE THE PERSON IS: Charlotte, across their whole record, with no board open.");
  });
});

describe("the hand-off to another AI", () => {
  const base: Omit<H7Input, "choice"> = {
    boardTitle: "Lasso pilot board",
    messages: [
      { role: "user", content: "Can I push to Lasso from Claude?" },
      { role: "assistant", content: "Yes." },
    ],
    used: [{ title: "Notes", kind: "document" }],
    board: [{ title: "Notes", kind: "document" }],
    viaConnector: true,
  };

  it("is byte-identical for Lasso with or without the brand", () => {
    for (const choice of ["chat_and_used", "answer_used", "full_board"] as const) {
      expect(packageHandoff({ ...base, choice, brand: lasso })).toBe(packageHandoff({ ...base, choice }));
    }
  });

  it("uses Charlotte's name for the app's words and keeps the person's words and the connector's real name", () => {
    const chat = packageHandoff({ ...base, choice: "chat_and_used", brand: charlotte });
    expect(chat).toContain('I was working on the Charlotte board "Lasso pilot board".');
    expect(chat).toContain("Charlotte: Yes.");
    expect(chat).toContain("You: Can I push to Lasso from Claude?");
    expect(chat).toContain("What Charlotte used:");
    expect(chat).toContain("Use the Lasso connector");
    const answer = packageHandoff({ ...base, choice: "answer_used", brand: charlotte });
    expect(answer).toContain("Charlotte's answer:\nYes.");
  });
});
