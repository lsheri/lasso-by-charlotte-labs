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

// 21 Nov 2026 (Liam: "it should be normal scale always"): the phone keeps a real iPhone's shape at any size, and is
// scaled down to fit its column rather than shrinking to the height of the message. The browser check measures it;
// these tests hold the rules that make it so.
describe("the devices keep a real device's shape", () => {
  const css = readFileSync("src/components/proposals/message-devices.css", "utf8");
  const rule = (selector: string) => {
    const at = css.indexOf(`${selector}{`);
    expect(at, `${selector} has a rule`).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf("}", at));
  };

  it("the phone is about 9 to 19.5, and its bezel, corners, island and home bar are sized from its own width", () => {
    expect(rule(".message-phone-frame")).toContain("container-type:inline-size");
    const phone = rule(".message-phone");
    expect(phone).toContain("aspect-ratio:9/19.5");
    expect(phone).toMatch(/border-radius:[\d.]+cqw/);
    expect(phone).toMatch(/border-width:max\(3px,[\d.]+cqw\)/);
    expect(rule(".message-phone-island")).toMatch(/width:[\d.]+cqw;height:[\d.]+cqw/);
    expect(rule(".message-phone-home")).toMatch(/width:[\d.]+cqw/);
    // Nothing on the phone is a fixed rem or px corner, and no height follows the message.
    expect(phone).not.toMatch(/border-radius:[\d.]+(rem|px)/);
  });

  it("neither device cuts words: a message longer than the screen makes the device taller, never clipped", () => {
    expect(rule(".message-phone")).not.toContain("overflow");
    expect(rule(".message-inbox")).toBe(".message-inbox{aspect-ratio:4/3");
    const view = render(<MessageExamples words={sent()} />);
    for (const device of view.container.querySelectorAll("[data-message-device]")) {
      expect((device as HTMLElement).className).not.toMatch(/overflow-(hidden|clip)/);
    }
  });

  it("the message sits at the top of a messages screen: the sender, then the thread, then empty screen down to the home bar", () => {
    const view = render(<MessageExamples words={sent()} />);
    const phone = view.container.querySelector('[data-message-device="text"]') as HTMLElement;
    const parts = [...phone.children].map((el) => el.getAttribute("data-message-sender") !== null ? "sender" : el.getAttribute("data-message-thread") !== null ? "thread" : el.className.includes("island") ? "island" : el.className.includes("home") ? "home" : "?");
    expect(parts).toEqual(["island", "sender", "thread", "home"]);
    const thread = phone.querySelector("[data-message-thread]") as HTMLElement;
    expect(thread.className).toMatch(/\bflex-1\b/);
    expect(thread.className).toMatch(/\bflex-col\b/);
    expect(thread.className).not.toMatch(/justify-(center|end)/);
    expect(thread.className).not.toMatch(/min-h-/);
    expect(within(thread).getByText(sent())).toBeTruthy();
    expect((phone.parentElement as HTMLElement).className).toMatch(/message-phone-frame/);
    expect((phone.parentElement as HTMLElement).className).toMatch(/max-w-\[13\.5rem\]/);
  });

  it("an example device keeps its own width and wraps, rather than being squeezed narrow and tall", () => {
    const view = render(<MessageExamples words={sent()} />);
    const items = [...view.container.querySelectorAll("[data-message-example]")] as HTMLElement[];
    expect(items).toHaveLength(3);
    for (const item of items) expect(item.className).toMatch(/\bshrink-0\b/);
    expect(items.map((item) => item.className.match(/max-w-\[[\d.]+rem\]/)?.[0])).toEqual(["max-w-[13.5rem]", "max-w-[22rem]", "max-w-[13.5rem]"]);
    expect(items.some((item) => /sm:w-auto/.test(item.className))).toBe(false);
  });
});
