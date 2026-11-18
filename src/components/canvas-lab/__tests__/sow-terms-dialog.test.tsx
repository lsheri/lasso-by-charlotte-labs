// @vitest-environment jsdom
// 18 Nov, firm brain: fee terms on a SOW. Existing terms load, "Read from the document" fills only what the server
// found, nothing saves until Save, bad input never reaches the server, and terms can be removed.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ read: vi.fn(), suggest: vi.fn(), save: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/sow-terms.functions", () => ({
  readSowTermsFn: (...a: unknown[]) => m.read(...a),
  suggestSowTermsFn: (...a: unknown[]) => m.suggest(...a),
  saveSowTermsFn: (...a: unknown[]) => m.save(...a),
}));

import { SowTermsDialog } from "@/components/canvas-lab/SowTermsDialog";

function open(onClose = vi.fn()) {
  render(<SowTermsDialog itemId="sow-1" title="SOW: Project Heron" profileId="p1" onClose={onClose} />);
  return onClose;
}

const fee = () => screen.getByLabelText("Fee, as written") as HTMLInputElement;
const weeks = () => screen.getByLabelText("Length in weeks") as HTMLInputElement;
const readButton = () => screen.getByRole("button", { name: "Read from the document" }) as HTMLButtonElement;
const loaded = () => waitFor(() => expect(readButton().disabled).toBe(false));

beforeEach(() => {
  m.read.mockReset().mockResolvedValue(null);
  m.suggest.mockReset();
  m.save.mockReset().mockResolvedValue(null);
});
afterEach(cleanup);

describe("SowTermsDialog", () => {
  it("loads saved terms and offers to remove them", async () => {
    m.read.mockResolvedValue({ fee_text: "$380k", fee_amount: 380000, fee_basis: "fixed", weeks: 10 });
    open();
    await waitFor(() => expect(fee().value).toBe("$380k"));
    expect(weeks().value).toBe("10");
    fireEvent.click(screen.getByRole("button", { name: "Remove fee terms" }));
    await waitFor(() => expect(m.save).toHaveBeenCalledWith({ data: expect.objectContaining({ item_id: "sow-1", clear: true }) }));
  });

  it("fills only what was found, says to check it, and saves nothing until Save", async () => {
    m.suggest.mockResolvedValue({ feeText: "£45,000 per month", weeks: "" });
    const onClose = open();
    await waitFor(() => expect(m.read).toHaveBeenCalled());
    fireEvent.change(weeks(), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Read from the document" }));
    await waitFor(() => expect(fee().value).toBe("£45,000 per month"));
    expect(weeks().value).toBe("8");
    expect(screen.getByText(/Check it before saving/)).toBeTruthy();
    expect(m.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save fee terms" }));
    await waitFor(() => expect(m.save).toHaveBeenCalledWith({ data: { item_id: "sow-1", profile_id: "p1", fee_text: "£45,000 per month", weeks: "8", clear: false } }));
    expect(onClose).toHaveBeenCalled();
  });

  it("says so when nothing was found word for word", async () => {
    m.suggest.mockResolvedValue({ feeText: "", weeks: "" });
    open();
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Read from the document" }));
    expect(await screen.findByText(/No fee or length found/)).toBeTruthy();
    expect(fee().value).toBe("");
  });

  it("keeps bad input away from the server", async () => {
    open();
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Save fee terms" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.change(fee(), { target: { value: "$380k" } });
    fireEvent.change(weeks(), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save fee terms" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/whole weeks/));
    expect(m.save).not.toHaveBeenCalled();
  });

  it("stays open with an honest line when the save or the read fails", async () => {
    m.save.mockRejectedValue(new Error("403"));
    m.suggest.mockRejectedValue(new Error("model down"));
    const onClose = open();
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Read from the document" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Enter the terms yourself/);
    fireEvent.change(fee(), { target: { value: "$90k" } });
    fireEvent.click(screen.getByRole("button", { name: "Save fee terms" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Could not save/));
    expect(onClose).not.toHaveBeenCalled();
  });
});
