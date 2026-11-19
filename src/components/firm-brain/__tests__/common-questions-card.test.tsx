// @vitest-environment jsdom
// 19 Nov, Firm Brain Build Spec step 8: "What people ask the firm". Admins and leads only; a fixed label and a band
// per line; the empty state in its exact words; no name, no exact count and no question wording anywhere.
import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COMMON_QUESTIONS_COPY, type CommonQuestion } from "@/lib/manager-tools-shared";

const m = vi.hoisted(() => ({ flag: true, read: vi.fn() }));
vi.mock("@/hooks/use-feature-flag", () => ({ useFeatureFlag: () => m.flag }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/manager-tools.functions", () => ({ commonQuestionKindsFn: (...a: unknown[]) => m.read(...a) }));

import { canSeeCommonQuestionsCard, CommonQuestionsCard } from "@/components/firm-brain/CommonQuestionsCard";

const admin = { id: "p1", role: "admin", has_firm_view: true, org_type: "company", is_guest: false };
const lines: CommonQuestion[] = [
  { label: "Setting the right price", band: "10 or more people" },
  { label: "Interviews", band: "5 to 9 people" },
];

beforeEach(() => {
  m.flag = true;
  m.read.mockReset();
});
afterEach(cleanup);

describe("who sees the card", () => {
  it("admins and leads of a company workspace", () => {
    expect(canSeeCommonQuestionsCard(admin)).toBe(true);
    expect(canSeeCommonQuestionsCard({ ...admin, role: "lead" })).toBe(true);
  });

  it("nobody else: an em, a coach, a guest, a personal workspace, no profile", () => {
    expect(canSeeCommonQuestionsCard({ ...admin, role: "em" })).toBe(false);
    expect(canSeeCommonQuestionsCard({ ...admin, role: "coach" })).toBe(false);
    expect(canSeeCommonQuestionsCard({ ...admin, is_guest: true })).toBe(false);
    expect(canSeeCommonQuestionsCard({ ...admin, has_firm_view: false, org_type: "personal" })).toBe(false);
    expect(canSeeCommonQuestionsCard(null)).toBe(false);
  });

  it("renders nothing and asks the server nothing for someone who may not see it", () => {
    render(<CommonQuestionsCard profile={{ ...admin, role: "em" }} />);
    expect(screen.queryByTestId("common-questions")).toBeNull();
    expect(m.read).not.toHaveBeenCalled();
  });
});

describe("CommonQuestionsCard", () => {
  it("says it is loading, then shows each kind with its band, in the order the server sent", async () => {
    let resolve!: (value: CommonQuestion[]) => void;
    m.read.mockReturnValue(new Promise<CommonQuestion[]>((yes) => (resolve = yes)));
    render(<CommonQuestionsCard profile={admin} />);
    expect(screen.getByRole("status").textContent).toBe(COMMON_QUESTIONS_COPY.loading);
    expect(m.read).toHaveBeenCalledWith({ data: { profile_id: "p1" } });
    resolve(lines);
    await waitFor(() => expect(document.querySelectorAll("[data-common-question]")).toHaveLength(2));
    expect([...document.querySelectorAll("[data-common-question]")].map((node) => node.textContent)).toEqual([
      "Setting the right price10 or more people",
      "Interviews5 to 9 people",
    ]);
  });

  it("shows the empty state in its exact words", async () => {
    m.read.mockResolvedValue([]);
    render(<CommonQuestionsCard profile={admin} />);
    await waitFor(() => expect(document.querySelector("[data-common-questions-empty]")).toBeTruthy());
    expect(document.querySelector("[data-common-questions-empty]")!.textContent).toBe(
      "Not enough people have asked yet. A kind of question appears here once five people have asked it.",
    );
  });

  it("says it could not load, without the error's own words", async () => {
    m.read.mockRejectedValue(new Error("relation events does not exist"));
    render(<CommonQuestionsCard profile={admin} />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(COMMON_QUESTIONS_COPY.error));
    expect(document.body.textContent).not.toContain("relation");
  });

  it("goes away when the server refuses", async () => {
    m.read.mockRejectedValue(new Response("Forbidden", { status: 403 }));
    render(<CommonQuestionsCard profile={admin} />);
    await waitFor(() => expect(screen.queryByTestId("common-questions")).toBeNull());
  });

  it("ignores an answer that returns after the card is gone", async () => {
    let resolve!: (value: CommonQuestion[]) => void;
    m.read.mockReturnValue(new Promise<CommonQuestion[]>((yes) => (resolve = yes)));
    const view = render(<CommonQuestionsCard profile={admin} />);
    view.unmount();
    resolve(lines);
    await Promise.resolve();
    expect(document.querySelector("[data-common-question]")).toBeNull();
  });

  it("has nowhere for a name, a count or a question to come from", () => {
    const source = readFileSync("src/components/firm-brain/CommonQuestionsCard.tsx", "utf8");
    expect(source).not.toMatch(/supabase|actor|display_name|askers|question_text|\.count\b/);
    // Only the firm view mounts it.
    expect(readFileSync("src/pages/FirmDashboardPage.tsx", "utf8")).toContain("<CommonQuestionsCard profile={");
  });
});
