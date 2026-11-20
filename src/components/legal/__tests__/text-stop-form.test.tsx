// @vitest-environment jsdom
// 19 Nov 2026: the stop form on a roster person's own /texts link. The server function is a prop, so a plain mock.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TextStopForm } from "@/components/legal/TextStopForm";
import { TEXT_STOP_COPY as COPY, type TextStopResult } from "@/lib/text-consent-shared";

afterEach(cleanup);

const ORG = "0000000a-0000-4000-8000-000000000001";
const PERSON = "0000000c-0000-4000-8000-000000000007";
const setup = (answer: TextStopResult = { ok: true }) => {
  const submit = vi.fn(async () => answer);
  render(<TextStopForm submit={submit} workspace={ORG} contact={PERSON} />);
  return submit;
};
const open = () => fireEvent.click(screen.getByRole("button", { name: COPY.open }));
const type = (value: string) =>
  fireEvent.change(screen.getByLabelText(COPY.phoneLabel), { target: { value } });
const press = () => fireEvent.click(screen.getByRole("button", { name: COPY.submit }));

describe("TextStopForm", () => {
  it("starts as one quiet button, with no field until it is opened", () => {
    setup();
    expect(screen.queryByLabelText(COPY.phoneLabel)).toBeNull();
    open();
    expect(screen.getByLabelText(COPY.phoneLabel)).toBeTruthy();
    expect(screen.getByText(COPY.intro)).toBeTruthy();
  });

  it("sends the typed number with the link's person and workspace, then confirms without repeating the number", async () => {
    const submit = setup();
    open();
    type("(206) 867-5309");
    press();
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith({
        phone: "(206) 867-5309",
        workspace: ORG,
        contact: PERSON,
      }),
    );
    expect((await screen.findByRole("status")).textContent).toContain(COPY.done);
    expect(document.body.textContent).not.toMatch(/867|5309/);
    expect(screen.queryByLabelText(COPY.phoneLabel)).toBeNull();
  });

  it("refuses an empty or malformed number without calling the server, and clears the line on edit", () => {
    const submit = setup();
    open();
    press();
    expect(screen.getByRole("alert").textContent).toBe(COPY.problem);
    type("12345");
    expect(screen.queryByRole("alert")).toBeNull();
    press();
    expect(screen.getByRole("alert").textContent).toBe(COPY.problem);
    expect(submit).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, reason: "busy" } as TextStopResult, COPY.failures.busy],
    [{ ok: false, reason: "unavailable" } as TextStopResult, COPY.failures.unavailable],
    [{ ok: false, reason: "invalid" } as TextStopResult, COPY.failures.invalid],
  ])(
    "keeps the form with a plain line when the server answers %j, never saying it stopped",
    async (answer, line) => {
      setup(answer);
      open();
      type("(206) 867-5309");
      press();
      expect((await screen.findByRole("alert")).textContent).toBe(line);
      expect(screen.queryByRole("status")).toBeNull();
      expect((screen.getByLabelText(COPY.phoneLabel) as HTMLInputElement).value).toBe(
        "(206) 867-5309",
      );
    },
  );

  it("says it did not go through on a network error, and sends once on a double press", async () => {
    const submit = vi.fn(async (): Promise<TextStopResult> => Promise.reject(new Error("offline")));
    render(<TextStopForm submit={submit} workspace={ORG} contact={PERSON} />);
    open();
    type("(206) 867-5309");
    const button = screen.getByRole("button", { name: COPY.submit });
    fireEvent.click(button);
    fireEvent.click(button);
    expect((await screen.findByRole("alert")).textContent).toBe(COPY.failures.unavailable);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("Keep texts closes the form, forgets what was typed and sends nothing", () => {
    const submit = setup();
    open();
    type("(206) 867-5309");
    fireEvent.click(screen.getByRole("button", { name: COPY.cancel }));
    expect(screen.queryByLabelText(COPY.phoneLabel)).toBeNull();
    open();
    expect((screen.getByLabelText(COPY.phoneLabel) as HTMLInputElement).value).toBe("");
    expect(submit).not.toHaveBeenCalled();
  });
});
