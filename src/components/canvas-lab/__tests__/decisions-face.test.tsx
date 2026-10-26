// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DecisionLine } from "@/hooks/use-decision-lines";
const h = vi.hoisted(() => ({ data: [] as DecisionLine[], isLoading: false, isError: false }));
vi.mock("@/hooks/use-decision-lines", async (original) => ({ ...await original<object>(), useDecisionLines: () => h }));
import { DecisionsFace } from "../DecisionsFace";
const line = (id: string, ord: number, status: DecisionLine["status"] = "draft"): DecisionLine => ({ id, document_id: "d", ord, call_text: id, why: "", status, srcs: [] });
afterEach(() => { cleanup(); h.data = []; h.isLoading = false; h.isError = false; });
describe("Decisions card live lines", () => {
  it("shows the first three live lines in order with current statuses and live and dropped counts", () => {
    h.data = [line("Fourth", 4), line("Dropped statement", 5, "discarded"), line("Third", 3), line("Second", 2, "confirmed"), line("First", 1)];
    const { container } = render(<DecisionsFace documentId="d" />);
    expect([...container.querySelectorAll(".lasso-decisions-statement")].map((node) => node.textContent)).toEqual(["First", "Second", "Third"]);
    expect(screen.getAllByText("Open")).toHaveLength(2);
    expect(screen.getByText("Agreed")).toBeTruthy();
    expect(screen.getByText("4 decisions · 1 dropped")).toBeTruthy();
    expect(screen.queryByText("Fourth")).toBeNull();
    expect(screen.queryByText("Dropped statement")).toBeNull();
  });
  it("omits the dropped count when there are none", () => {
    h.data = [line("First", 1)]; render(<DecisionsFace documentId="d" />);
    expect(screen.getByText("1 decisions")).toBeTruthy();
    expect(screen.queryByText(/dropped/)).toBeNull();
  });
  it("shows an empty record without inventing lines", () => { render(<DecisionsFace documentId="d" />); expect(screen.getByText("No decisions yet")).toBeTruthy(); });
  it("shows three loading placeholders", () => { h.isLoading = true; const { container } = render(<DecisionsFace documentId="d" />); expect(container.querySelectorAll(".lasso-decisions-placeholders span")).toHaveLength(3); });
  it("does not report an empty record when reading fails", () => { h.isError = true; render(<DecisionsFace documentId="d" />); expect(screen.getByText("Decisions could not be opened.")).toBeTruthy(); expect(screen.queryByText("0 decisions")).toBeNull(); });
});