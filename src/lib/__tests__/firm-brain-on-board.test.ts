// 19 Nov: with the company-brain flag retired, nothing else hid the firm brain board controls from a company member
// who is a guest on another firm's board. They show only on boards in the person's own workspace.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { firmBrainBoardScope } from "@/lib/firm-ask-shared";

const member = { org_id: "org-a", role: "em", has_firm_view: true, org_type: "company" };

describe("firm brain controls on a board", () => {
  it("a board in the person's own workspace is theirs", () => {
    expect(firmBrainBoardScope(member, "org-a")).toBe("own");
  });

  it("another firm's board, where the person is a guest, shows nothing", () => {
    expect(firmBrainBoardScope(member, "org-b")).toBe("other");
  });

  it("a coach, a personal workspace and no profile get nothing on any board", () => {
    expect(firmBrainBoardScope({ ...member, role: "coach" }, "org-a")).toBe("other");
    expect(firmBrainBoardScope({ ...member, has_firm_view: false, org_type: "personal" }, "org-a")).toBe("other");
    expect(firmBrainBoardScope(null, "org-a")).toBe("other");
    expect(firmBrainBoardScope(undefined, undefined)).toBe("other");
  });

  it("a board whose row the person cannot read, or that has not loaded, is unknown and never counts as theirs", () => {
    expect(firmBrainBoardScope(member, undefined)).toBe("unknown");
    expect(firmBrainBoardScope(member, null)).toBe("unknown");
    expect(firmBrainBoardScope({ ...member, org_id: null }, null)).toBe("unknown");
  });

  it("is the one rule the board page uses for every firm brain control", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    expect(page).toContain("const firmBrainScope = firmBrainBoardScope(profile, engagement?.org_id);");
    // Start a proposal, Red pen and How it ended need the board to be known as the person's own.
    expect(page).toContain('const proposalAllowed = firmBrainScope === "own" && boardEditable;');
    // Fee terms and the reading list never needed board membership; they only go on another firm's board.
    expect(page).toContain('const feeTermsAllowed = firmBrainScope !== "other" && canSetFees(profile?.role);');
    expect(page).toContain('const readingListAllowed = firmBrainScope !== "other" && profile?.is_guest !== true;');
    // No control falls back to the workspace-only rule.
    expect(page).not.toContain("canAskTheFirm(");
    for (const control of ["BoardOutcomeDialog", "RedPenPanel", "ProposalStartPanel"]) expect(page).toMatch(new RegExp(`\\{proposalAllowed[^\\n]{0,40}<${control} `));
  });
});
