// @vitest-environment jsdom
// 21 Nov 2026, chat pill PR 4c (D-97): deciding the final proposal on the Lead's Up next row.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeadFinalBlock, type FinalTools } from "@/components/home/LeadFinalBlock";
import { FINAL_COPY } from "@/lib/proposal-final-shared";

afterEach(cleanup);
const NOW = new Date("2026-11-21T12:00:00Z");

function open(over: Partial<FinalTools> = {}, final: { itemId: string; title: string; chosenAt: string } | null = null) {
  const tools: FinalTools = {
    choose: vi.fn(async (_p, itemId) => ({ ok: true as const, final: { itemId, title: itemId === "d1" ? "Larkspur RFP" : "Proposal draft: Review", chosenAt: NOW.toISOString() } })),
    draft: vi.fn(async () => ({ ok: true as const, itemId: "draft-1", title: "Proposal draft: Review", gaps: 1, questions: 3 })),
    upload: vi.fn(async () => ({ ids: ["up-1"], failures: [] })),
    ...over,
  };
  render(<LeadFinalBlock proposalId="p1" final={final} documents={[{ id: "d1", title: "Larkspur RFP" }]} tools={tools} now={NOW} />);
  return tools;
}

describe("the final proposal on the Lead's row", () => {
  it("none yet says the three ways", () => {
    open();
    expect(screen.getByText(FINAL_COPY.none)).toBeTruthy();
    expect(screen.getByRole("button", { name: FINAL_COPY.upload })).toBeTruthy();
    expect(screen.getByRole("button", { name: FINAL_COPY.draft })).toBeTruthy();
  });

  it("use a sent document as the final, and the line says so", async () => {
    const tools = open();
    fireEvent.click(screen.getByRole("button", { name: FINAL_COPY.useDocument("Larkspur RFP") }));
    await waitFor(() => expect(tools.choose).toHaveBeenCalledWith("p1", "d1", "document"));
    expect(await screen.findByText(FINAL_COPY.changed)).toBeTruthy();
    expect(document.querySelector("[data-led-final-line]")!.textContent).toContain("Larkspur RFP");
  });

  it("a draft comes back with its gaps and questions, and is chosen only on the press", async () => {
    const tools = open();
    fireEvent.click(screen.getByRole("button", { name: FINAL_COPY.draft }));
    expect(await screen.findByText(FINAL_COPY.draftGaps(1, 3))).toBeTruthy();
    expect(tools.choose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: FINAL_COPY.useDraft }));
    await waitFor(() => expect(tools.choose).toHaveBeenCalledWith("p1", "draft-1", "draft"));
  });

  it("an upload becomes the final", async () => {
    const tools = open();
    const input = document.querySelector<HTMLInputElement>("[data-led-final-file]")!;
    fireEvent.change(input, { target: { files: [new File(["x"], "final.pdf", { type: "application/pdf" })] } });
    await waitFor(() => expect(tools.choose).toHaveBeenCalledWith("p1", "up-1", "upload"));
  });

  it("a failed upload, draft or choice each say so plainly and choose nothing", async () => {
    const tools = open({ upload: async () => ({ ids: [], failures: [{ name: "x.pdf", reason: "too big" }] }) });
    fireEvent.change(document.querySelector<HTMLInputElement>("[data-led-final-file]")!, { target: { files: [new File(["x"], "x.pdf")] } });
    expect(await screen.findByText(FINAL_COPY.uploadFailed("too big"))).toBeTruthy();
    expect(tools.choose).not.toHaveBeenCalled();
    cleanup();
    open({ draft: async () => ({ ok: false, problem: FINAL_COPY.noBrief }) });
    fireEvent.click(screen.getByRole("button", { name: FINAL_COPY.draft }));
    expect(await screen.findByText(FINAL_COPY.noBrief)).toBeTruthy();
    cleanup();
    open({ choose: async () => ({ ok: false, problem: FINAL_COPY.notReady }) });
    fireEvent.click(screen.getByRole("button", { name: FINAL_COPY.useDocument("Larkspur RFP") }));
    expect(await screen.findByText(FINAL_COPY.notReady)).toBeTruthy();
  });

  it("a double press drafts once", async () => {
    let finish: () => void = () => undefined;
    const draft = vi.fn(() => new Promise<{ ok: false; problem: string }>((resolve) => (finish = () => resolve({ ok: false, problem: "x" }))));
    open({ draft });
    const button = screen.getByRole("button", { name: FINAL_COPY.draft });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(draft).toHaveBeenCalledTimes(1);
    finish();
  });

  it("a final whose document was deleted says so and asks to choose again", () => {
    open({}, { itemId: "", title: "", chosenAt: "2026-11-21T09:00:00Z", gone: true } as never);
    expect(document.querySelector("[data-led-final]")!.getAttribute("data-led-final")).toBe("gone");
    expect(document.querySelector("[data-led-final-line]")!.textContent).toMatch(/was deleted\. Choose the final again\./);
  });

  it("the chosen final shows with its day, and that document cannot be chosen again", () => {
    open({}, { itemId: "d1", title: "Larkspur RFP", chosenAt: "2026-11-21T09:00:00Z" });
    expect(document.querySelector("[data-led-final-line]")!.textContent).toMatch(/Larkspur RFP, chosen/);
    expect((screen.getByRole("button", { name: FINAL_COPY.useDocument("Larkspur RFP") }) as HTMLButtonElement).disabled).toBe(true);
  });
});
