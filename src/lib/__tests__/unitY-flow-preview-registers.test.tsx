// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { FlowPreview } from "@/components/onboarding/FlowPreview";
import type { Register } from "@/lib/register";
import { SIGNUP_BANNED_COPY } from "@/lib/signup-copy-laws";

beforeAll(() => {
  // Reduced motion renders all four beats at once, so every caption is in the DOM.
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => cleanup());

const EXPECTED: Record<Register, string[]> = {
  company: [
    "You work in your AI tools", "Claude, ChatGPT, Drive, meetings.",
    "It flows into Lasso", "Work arrives in the workspace you created.",
    "You map it", "Give it a workboard and a workstream. It becomes a record.",
    "A coach sees what you share", "A coach sees the shared view.",
  ],
  personal: [
    "You work in your AI tools", "Claude, ChatGPT, Drive, your own notes.",
    "It flows into Lasso", "Work arrives in the workspace you created.",
    "You file it", "Put it under one of your workboards. It becomes part of your record.",
    "The record stays yours", "Share a piece when you want to.",
  ],
  edu: [
    "You work in your AI tools", "Claude, ChatGPT, Drive, lecture notes.",
    "It flows into Lasso", "Work arrives in the workspace you created.",
    "You file it", "Put it under a class or workboard, next to the coursework it belongs to.",
    "You choose what to share", "Share one piece when you want to.",
  ],
  partner: [
    "You set up the workboard", "A client, a cohort, the workstreams you will run.",
    "People join with a link", "Their workspace stays theirs. Yours holds the workboard.",
    "They share what they choose", "A board or transcript, at the depth they agreed to.",
    "You coach from what arrived", "You coach from what they sent you.",
  ],
};

describe("Unit Y1: FlowPreview captions follow the register", () => {
  for (const register of ["company", "personal", "edu", "partner"] as const) {
    it(register, () => {
      const { container } = render(<FlowPreview register={register} />);
      const text = container.textContent ?? "";
      for (const s of EXPECTED[register]) expect(text).toContain(s);
      expect(text).not.toMatch(SIGNUP_BANNED_COPY);
      expect(text).not.toContain("\u2014");
    });
  }

  it("personal and edu never mention engagements or clients", () => {
    for (const register of ["personal", "edu"] as const) {
      const { container } = render(<FlowPreview register={register} />);
      expect(container.textContent ?? "").not.toMatch(/engagement|client|workstream|professor/i);
      cleanup();
    }
  });

  it("with no register it keeps the original captions", () => {
    const { container } = render(<FlowPreview />);
    for (const s of EXPECTED.company) expect(container.textContent).toContain(s);
  });
});
