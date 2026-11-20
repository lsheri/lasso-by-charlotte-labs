// @vitest-environment jsdom
// 20 Nov 2026 (Liam, on the design review): a message is shown in the device it arrives on, and the words in the
// device are the words that go out. These tests fail if a device ever shows a message cut, reworded or re-authored.
import { cleanup, render, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AskDialog } from "@/components/proposals/AskLead";
import { MessageExamples } from "@/components/proposals/MessageExamples";
import { ASK_COPY, leadAskBody } from "@/lib/lead-ask-shared";
import type { DeskProposal } from "@/lib/proposal-desk-shared";
import { MESSAGE_EXAMPLES_COPY, wonTextBody } from "@/lib/won-text-shared";

afterEach(cleanup);

/** The ask as filed with the carriers, sample 2. It must never change by a letter. */
const FILED = "Lasso for Kestrel Bay Advisory: hi Christy, Maren would love you to lead a new proposal. Are you in? Reply YES or NO. Reply STOP to opt out.";
const sent = () => leadAskBody({ brandName: "Lasso", firmName: "Kestrel Bay Advisory", leadName: "Christy Johnson", askerName: "Maren Hollis" });

describe("the ask, in the phone", () => {
  it("the sender's own function still writes the filed sample, word for word", () => {
    expect(sent()).toBe(FILED);
  });

  it("the phone shows the whole message the server hands over: the firm, the ask and the opt-out line", async () => {
    const words = sent();
    const proposal = { id: "a", title: "Review", leadName: "Christy Johnson" } as DeskProposal;
    for (const mode of ["real", "practice", "demo"] as const) {
      const view = render(<AskDialog proposal={proposal} load={async () => ({ ok: true, words, name: "Christy Johnson", mode, warning: null })} send={vi.fn()} onClose={vi.fn()} />);
      const dialog = await view.findByTestId("ask-lead");
      const phone = await within(dialog).findByText(words);
      expect(phone.hasAttribute("data-ask-words")).toBe(true);
      expect(phone.textContent).toBe(FILED);
      expect(phone.closest('[data-message-device="text"]')).not.toBeNull();
      expect(phone.textContent).toContain("Reply STOP to opt out.");
      expect(phone.textContent?.startsWith("Lasso for Kestrel Bay Advisory:")).toBe(true);
      // The sender is the product, with its mark as the picture. Never a number.
      const device = phone.closest("[data-message-device]") as HTMLElement;
      expect(device.querySelector("[data-message-sender-picture]")).not.toBeNull();
      expect(within(device).getByText("Lasso")).toBeTruthy();
      expect(device.textContent).not.toMatch(/\+?\d[\d ()-]{6,}\d/);
      expect(device.querySelectorAll("button, a, input")).toHaveLength(0);
      // "Christy gets" only when the text really goes to Christy.
      expect(dialog.querySelector("[data-ask-gets]")?.textContent).toBe(mode === "real" ? "Christy gets" : "Christy would get");
      // Every state the old dialog had is still said.
      expect(dialog.textContent).toContain(mode === "practice" ? ASK_COPY.practiceHelper : ASK_COPY.helper);
      if (mode === "demo") expect(dialog.textContent).toContain(ASK_COPY.demoHelper);
      expect(within(dialog).getByRole("button", { name: mode === "practice" ? ASK_COPY.sendPractice : ASK_COPY.send })).toBeTruthy();
      view.unmount();
    }
  });

  it("the dialog writes no message of its own: the words come only from the preview", () => {
    const source = readFileSync("src/components/proposals/AskLead.tsx", "utf8") + readFileSync("src/components/proposals/MessageDevices.tsx", "utf8");
    expect(source).not.toMatch(/would love you|Are you in|Reply YES|Reply STOP|opt out/i);
    expect(source).toContain("{ready.words}");
  });
});

describe("the won message, three ways", () => {
  it("the text sits in a phone, the email in an inbox, the RCS message in a phone, each labelled as the product labels it", () => {
    const WON = wonTextBody({ brandName: "Lasso", firmName: "Kestrel Bay Advisory" });
    expect(WON).toContain("Reply STOP");
    const view = render(<MessageExamples words={WON} />);
    const copy = MESSAGE_EXAMPLES_COPY;
    const examples = [...view.container.querySelectorAll("[data-message-example]")] as HTMLElement[];
    expect(examples.map((e) => e.querySelector("[data-message-device]")?.getAttribute("data-message-device"))).toEqual(["text", "email", "rcs"]);
    expect(examples.map((e) => e.getAttribute("data-message-example"))).toEqual(["live", "example", "example"]);
    const [text, email, rcs] = examples as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(text).getByText(copy.textState)).toBeTruthy();
    expect(text.querySelector("[data-won-text-words]")?.textContent).toBe(WON);
    expect(within(email).getByText(copy.emailState)).toBeTruthy();
    for (const line of [copy.subject, copy.emailBody, copy.emailFoot]) expect(within(email).getByText(line)).toBeTruthy();
    expect(within(rcs).getByText(copy.rcsState)).toBeTruthy();
    for (const line of [copy.rcsSender, copy.rcsTitle, copy.rcsBody, copy.rcsYes, copy.rcsNo]) expect(within(rcs).getByText(line)).toBeTruthy();
    expect(view.getByText(copy.note)).toBeTruthy();
    // Pictures only: nothing to press, no channel to pick.
    expect(view.container.querySelectorAll("button, a, input, select, [role='radio'], [role='tab']")).toHaveLength(0);
    expect(view.container.querySelectorAll("[data-message-sender-picture]")).toHaveLength(3);
    expect(view.container.textContent).not.toMatch(/\+?\d[\d ()-]{6,}\d/);
  });

  it("the examples file writes no message of its own", () => {
    const source = readFileSync("src/components/proposals/MessageExamples.tsx", "utf8");
    expect(source).not.toMatch(/Good news|has been won|Unsubscribe|Reply STOP/i);
  });
});
