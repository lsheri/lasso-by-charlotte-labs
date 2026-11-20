// @vitest-environment jsdom
// 19 Nov, demo tour: the founder's seed page controls. Nothing is written until a button is pressed.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ add: vi.fn(), reset: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/demo-firm.functions", () => ({ seedTourLoginsFn: (...a: unknown[]) => m.add(...a), resetTourFn: (...a: unknown[]) => m.reset(...a) }));

import { TOUR_SEED_COPY, TourSeedPanel } from "@/components/qa/TourSeedPanel";

beforeEach(() => {
  m.add.mockReset().mockResolvedValue({
    logins: [
      { email: "tour-partner@kestrelbay.test", name: "Rowan Ashby", plays: "Partner", password: "pw-one" },
      { email: "tour-lead@kestrelbay.test", name: "Jules Marlow", plays: "Engagement lead", password: "pw-two" },
    ],
  });
  m.reset.mockReset().mockResolvedValue({ ok: true, refused: false, problems: [], left: { shared: false, ledgerRows: 3, value: "380000 USD", marks: 0, draft: true } });
});
afterEach(cleanup);

describe("the demo tour panel", () => {
  it("calls nothing on load, and asks once more before creating logins", () => {
    render(<TourSeedPanel profileId="p1" />);
    expect(m.add).not.toHaveBeenCalled();
    expect(m.reset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: TOUR_SEED_COPY.add }));
    expect(m.add).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: TOUR_SEED_COPY.cancel }));
    expect(m.add).not.toHaveBeenCalled();
  });

  it("shows each login's own password once, labelled with who it plays", async () => {
    render(<TourSeedPanel profileId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: TOUR_SEED_COPY.add }));
    fireEvent.click(screen.getByRole("button", { name: TOUR_SEED_COPY.confirmAdd }));
    const partner = (await screen.findByLabelText("Partner: Rowan Ashby, tour-partner@kestrelbay.test")) as HTMLInputElement;
    const lead = screen.getByLabelText("Engagement lead: Jules Marlow, tour-lead@kestrelbay.test") as HTMLInputElement;
    expect([partner.value, lead.value]).toEqual(["pw-one", "pw-two"]);
    expect(m.add).toHaveBeenCalledWith({ data: { profile_id: "p1" } });
  });

  it("says what the reset left", async () => {
    render(<TourSeedPanel profileId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: TOUR_SEED_COPY.reset }));
    const status = await screen.findByRole("status");
    expect(status.textContent).toContain(TOUR_SEED_COPY.clean);
    expect(status.textContent).toContain("Left: not shared, 3 ledger rows, value 380000 USD, 0 marks, draft kept");
  });

  it("says nothing was changed when the reset refuses, and warns when the board is not clean", async () => {
    m.reset.mockResolvedValue({ ok: false, refused: true, left: null, problems: ["The kept proposal draft is missing. Nothing was changed."] });
    render(<TourSeedPanel profileId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: TOUR_SEED_COPY.reset }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain(TOUR_SEED_COPY.refused));
    expect(screen.getByRole("status").textContent).toContain("The kept proposal draft is missing.");
    cleanup();
    m.reset.mockResolvedValue({ ok: false, refused: false, problems: ["marks: refused"], left: { shared: true, ledgerRows: 4, value: "380000 USD", marks: 1, draft: true } });
    render(<TourSeedPanel profileId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: TOUR_SEED_COPY.reset }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain(TOUR_SEED_COPY.notClean));
    expect(screen.getByRole("status").textContent).toContain("Left: shared, 4 ledger rows");
  });

  it("shows a failed call as a plain line", async () => {
    m.add.mockRejectedValue(new Error("Forbidden"));
    render(<TourSeedPanel profileId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: TOUR_SEED_COPY.add }));
    fireEvent.click(screen.getByRole("button", { name: TOUR_SEED_COPY.confirmAdd }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Stopped: Forbidden"));
  });
});
