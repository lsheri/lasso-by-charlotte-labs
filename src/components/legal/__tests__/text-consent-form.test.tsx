// @vitest-environment jsdom
// 19 Nov 2026: the form at /texts. The server function is a prop, so it is a plain mock here.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

import { TextConsentForm } from "@/components/legal/TextConsentForm";
import {
  TEXT_CONSENT_COPY as COPY,
  TEXT_CONSENT_WORDING,
  type TextConsentResult,
} from "@/lib/text-consent-shared";

// Radix's checkbox measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

afterEach(cleanup);

const ORG = "0000000a-0000-4000-8000-000000000001";
const setup = (answer: TextConsentResult | Promise<TextConsentResult> = { ok: true }) => {
  const submit = vi.fn(async () => answer);
  render(<TextConsentForm submit={submit} workspace={ORG} />);
  return submit;
};
const fill = (name = "Renée O'Neill", phone = "(206) 867-5309") => {
  fireEvent.change(screen.getByLabelText(COPY.nameLabel), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(COPY.phoneLabel), { target: { value: phone } });
};
const box = () => screen.getByRole("checkbox", { name: TEXT_CONSENT_WORDING });
const press = () => fireEvent.click(screen.getByRole("button", { name: COPY.submit }));

describe("TextConsentForm", () => {
  it("shows the registered wording beside a box that starts unticked, with links to both policies", () => {
    setup();
    expect(box().getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText(TEXT_CONSENT_WORDING)).toBeTruthy();
    expect(screen.getByRole("link", { name: COPY.privacy }).getAttribute("href")).toBe("/privacy");
    expect(screen.getByRole("link", { name: COPY.terms }).getAttribute("href")).toBe("/terms");
  });

  it("will not send without the tick, and says why", () => {
    const submit = setup();
    fill();
    press();
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText(COPY.problems.agree)).toBeTruthy();
    expect(box().getAttribute("aria-invalid")).toBe("true");
  });

  it("refuses a bad number and an empty name before anything is sent", () => {
    const submit = setup();
    fill("", "+44 20 7946 0958");
    fireEvent.click(box());
    press();
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText(COPY.problems.name)).toBeTruthy();
    expect(screen.getByText(COPY.problems.phone)).toBeTruthy();
  });

  it("sends what was typed with the link's workspace, then confirms without repeating the number", async () => {
    const submit = setup();
    fill();
    fireEvent.click(box());
    press();
    await screen.findByText(COPY.doneHeading);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({
      name: "Renée O'Neill",
      phone: "(206) 867-5309",
      agreed: true,
      workspace: ORG,
    });
    expect(screen.getByRole("status").textContent).toContain(COPY.done);
    expect(document.body.textContent).not.toMatch(/867|5309/);
    expect(screen.queryByRole("button", { name: COPY.submit })).toBeNull();
  });

  it("sends once when pressed twice", async () => {
    let finish: (value: TextConsentResult) => void = () => {};
    const submit = setup(new Promise<TextConsentResult>((resolve) => (finish = resolve)));
    fill();
    fireEvent.click(box());
    const form = screen.getByLabelText(COPY.nameLabel).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(submit).toHaveBeenCalledTimes(1);
    finish({ ok: true });
    await screen.findByText(COPY.doneHeading);
  });

  it.each([
    ["unavailable", COPY.failures.unavailable],
    ["busy", COPY.failures.busy],
    ["invalid", COPY.failures.invalid],
  ] as const)("stays open with a plain line when the server answers %s", async (reason, line) => {
    setup({ ok: false, reason, ...(reason === "invalid" ? { problems: ["phone" as const] } : {}) });
    fill();
    fireEvent.click(box());
    press();
    expect((await screen.findByRole("alert")).textContent).toBe(line);
    expect(screen.queryByText(COPY.doneHeading)).toBeNull();
    // What the person typed is still there, and they can try again.
    expect((screen.getByLabelText(COPY.phoneLabel) as HTMLInputElement).value).toBe(
      "(206) 867-5309",
    );
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: COPY.submit }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    if (reason === "invalid") expect(screen.getByText(COPY.problems.phone)).toBeTruthy();
  });

  it("stays open when the request itself fails", async () => {
    const submit = vi.fn(async () => {
      throw new Error("network");
    });
    render(<TextConsentForm submit={submit} />);
    fill();
    fireEvent.click(box());
    press();
    expect((await screen.findByRole("alert")).textContent).toBe(COPY.failures.unavailable);
  });

  it("drops a field's complaint as soon as that field is changed, and keeps the others", () => {
    setup();
    fill("", "nope");
    press();
    fireEvent.change(screen.getByLabelText(COPY.phoneLabel), {
      target: { value: "(206) 867-5309" },
    });
    expect(screen.queryByText(COPY.problems.phone)).toBeNull();
    expect(screen.getByText(COPY.problems.name)).toBeTruthy();
    expect(screen.getByText(COPY.problems.agree)).toBeTruthy();
    fireEvent.click(box());
    expect(screen.queryByText(COPY.problems.agree)).toBeNull();
  });

  it("unticking after ticking blocks the send again", () => {
    const submit = setup();
    fill();
    fireEvent.click(box());
    fireEvent.click(box());
    press();
    expect(submit).not.toHaveBeenCalled();
  });
});
