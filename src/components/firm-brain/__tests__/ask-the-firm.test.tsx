// @vitest-environment jsdom
// 17 Nov, firm brain PR 4: the Ask the firm box. Hidden outside company workspaces and for coaches;
// "What we charged" only for admins and leads; answers show claims with their sources and client marks, the coverage
// line, and never stretch when nothing is found. A source opens a read-only preview.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FirmAskResult } from "@/lib/firm-ask-shared";

const m = vi.hoisted(() => ({
  ask: vi.fn(),
  preview: vi.fn(),
  keepOut: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/firm-ask.functions", () => ({
  askTheFirm: (...a: unknown[]) => m.ask(...a),
  previewFirmSource: (...a: unknown[]) => m.preview(...a),
  keepOutOfFirmAnswers: (...a: unknown[]) => m.keepOut(...a),
}));

import { AskTheFirm } from "@/components/firm-brain/AskTheFirm";

const member = { id: "p1", role: "em", has_firm_view: true, org_type: "company" };

function wrap(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

const answered: FirmAskResult = {
  status: "answered",
  summary: "The firm designed a weight management service line.",
  claims: [{ text: "Giving surgery a vote early unlocked the design.", itemId: "i1", boardId: "b5", quote: "Getting surgery a vote in governance early unlocked the design", grade: "quoted" }],
  facts: [{ boardId: "b5", title: "Weight management service line", client: "St. Brigid Health", lead: "Tiago Pereira", weeks: 16, outcome: "Ran to plan.", fee: null }],
  nearest: null,
  read: { full: ["i1"], summary: ["i2"] },
  sources: {
    i1: { title: "Final readout", type: "deck", date: "2025-06-20", boardId: "b5", boardTitle: "Weight management service line", shownOn: "2025-06-24" },
    i2: { title: "CMO interview", type: "call", date: "2025-03-20", boardId: "b5", boardTitle: "Weight management service line", shownOn: null },
  },
  coverage: "Read 26 engagements shared with the firm. Some engagements are not shared.",
  oneSource: true,
};

beforeEach(() => {
  m.ask.mockReset();
  m.preview.mockReset();
  m.keepOut.mockReset();
});
afterEach(cleanup);

describe("who sees the box", () => {
  it("shows for a member of a company workspace, with no flag asked", () => {
    wrap(<AskTheFirm profile={member} />);
    expect(screen.getByTestId("ask-the-firm")).toBeTruthy();
  });

  it("stays hidden outside company workspaces, and for coaches", () => {
    const { rerender } = wrap(<AskTheFirm profile={{ ...member, has_firm_view: false, org_type: "personal" }} />);
    expect(screen.queryByTestId("ask-the-firm")).toBeNull();
    rerender(<QueryClientProvider client={new QueryClient()}><AskTheFirm profile={{ ...member, role: "coach" }} /></QueryClientProvider>);
    expect(screen.queryByTestId("ask-the-firm")).toBeNull();
  });

  it("offers What we charged only to admins and leads", () => {
    const { rerender } = wrap(<AskTheFirm profile={member} />);
    expect(document.querySelector('[data-firm-starter="charged"]')).toBeNull();
    rerender(<QueryClientProvider client={new QueryClient()}><AskTheFirm profile={{ ...member, role: "lead" }} /></QueryClientProvider>);
    expect(document.querySelector('[data-firm-starter="charged"]')).not.toBeNull();
  });
});

describe("asking", () => {
  it("shows claims with their sources, the client mark, the facts strip and the coverage line", async () => {
    m.ask.mockResolvedValue(answered);
    wrap(<AskTheFirm profile={member} />);
    fireEvent.change(screen.getByLabelText("Question for the firm"), { target: { value: "Have we done weight management work?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(document.querySelector('[data-firm-answer="answered"]')).not.toBeNull());
    expect(m.ask).toHaveBeenCalledWith({ data: { question: "Have we done weight management work?", starter: null, profile_id: "p1" } });
    expect(screen.getByText("Giving surgery a vote early unlocked the design.")).toBeTruthy();
    expect(document.querySelector("[data-firm-source-shown]")!.textContent).toBe("Shown to client, 24 Jun 2025");
    expect(document.querySelector("[data-firm-facts]")!.textContent).toContain("16 weeks");
    expect(document.querySelector("[data-firm-coverage]")!.textContent).toContain("Some engagements are not shared.");
    expect(screen.getByText("This answer rests on one source.")).toBeTruthy();
  });

  it("records which starter began the question", async () => {
    m.ask.mockResolvedValue({ ...answered, status: "not_found", claims: [], summary: null, facts: [], nearest: null });
    wrap(<AskTheFirm profile={member} />);
    fireEvent.click(document.querySelector('[data-firm-starter="went_wrong"]')!);
    const field = screen.getByLabelText("Question for the firm") as HTMLInputElement;
    expect(field.value).toBe("What went wrong on past engagements like ");
    fireEvent.change(field, { target: { value: `${field.value}service line design?` } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(m.ask).toHaveBeenCalled());
    expect(m.ask.mock.calls[0]![0].data.starter).toBe("went_wrong");
  });

  it("says not found plainly, with the nearest work when there is one", async () => {
    m.ask.mockResolvedValue({ ...answered, status: "not_found", claims: [], summary: null, facts: [], nearest: "Diligence on an HVAC roll-up, a different business." });
    wrap(<AskTheFirm profile={member} />);
    fireEvent.change(screen.getByLabelText("Question for the firm"), { target: { value: "Staffing diligence?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(document.querySelector('[data-firm-answer="not_found"]')).not.toBeNull());
    expect(screen.getByText("Not found in work shared with the firm. Some engagements are not shared.")).toBeTruthy();
    expect(screen.getByText(/Nearest shared work: Diligence on an HVAC roll-up/)).toBeTruthy();
  });

  it("goes away when the server says this person may not ask", async () => {
    m.ask.mockRejectedValue(new Response("Forbidden", { status: 403 }));
    wrap(<AskTheFirm profile={member} />);
    fireEvent.change(screen.getByLabelText("Question for the firm"), { target: { value: "Anything?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(screen.queryByTestId("ask-the-firm")).toBeNull());
  });

  it("says the daily limit was reached, not try again, when the server refuses for spend", async () => {
    m.ask.mockRejectedValue(new Response("limit", { status: 429 }));
    wrap(<AskTheFirm profile={member} />);
    fireEvent.change(screen.getByLabelText("Question for the firm"), { target: { value: "Anything?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(screen.getByText("Today's limit for the firm brain has been reached. It resets at midnight UTC.")).toBeTruthy());
    expect(screen.queryByText("That did not work. Try again.")).toBeNull();
    // The box stays: tomorrow it works again.
    expect(screen.getByTestId("ask-the-firm")).toBeTruthy();
  });

  it("still says try again for any other failure", async () => {
    m.ask.mockRejectedValue(new Error("network"));
    wrap(<AskTheFirm profile={member} />);
    fireEvent.change(screen.getByLabelText("Question for the firm"), { target: { value: "Anything?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(screen.getByText("That did not work. Try again.")).toBeTruthy());
    expect(screen.queryByText(/Today's limit/)).toBeNull();
  });

  it("opens a source as a read-only preview, and lets its author keep it out", async () => {
    m.ask.mockResolvedValue(answered);
    m.preview.mockResolvedValue({ itemId: "i1", title: "Final readout", boardTitle: "Weight management service line", type: "deck", date: "2025-06-20", grade: "full", text: "Slide 3: Getting surgery a vote in governance early unlocked the design.", shownOn: "2025-06-24", canKeepOut: true });
    m.keepOut.mockResolvedValue({ ok: true });
    wrap(<AskTheFirm profile={member} />);
    fireEvent.change(screen.getByLabelText("Question for the firm"), { target: { value: "Weight management?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(document.querySelector('[data-firm-source="quoted"]')).not.toBeNull());
    fireEvent.click(document.querySelector('[data-firm-source="quoted"]')!);
    await waitFor(() => expect(document.querySelector("[data-firm-preview-text]")).not.toBeNull());
    expect(m.preview).toHaveBeenCalledWith({ data: { item_id: "i1", profile_id: "p1" } });
    fireEvent.click(screen.getByRole("button", { name: "Keep this out of firm answers" }));
    await waitFor(() => expect(screen.getByText("Kept out. It will not appear in firm answers.")).toBeTruthy());
    expect(m.keepOut).toHaveBeenCalledWith({ data: { item_id: "i1", profile_id: "p1" } });
  });
});
