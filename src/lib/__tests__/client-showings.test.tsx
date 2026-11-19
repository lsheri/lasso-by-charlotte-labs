// @vitest-environment jsdom
// Liam, 16 Nov: firm brain phase 1, Shown to client. Owner or editor marks a deliverable as put in front of the
// client; board members read the marks; company workspaces only; signed-in board only.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClientShownDialog } from "@/components/canvas-lab/ClientShownDialog";
import { ClientShownLine } from "@/components/canvas-lab/ClientShownLine";
import { LabCardMenu } from "@/components/canvas-lab/LabCardMenu";
import {
  CLIENT_SHOWN_COPY,
  canMarkShown,
  shownLine,
  showingsByItem,
  validateShowing,
  type ClientShowing,
} from "@/lib/client-showings-shared";
import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

afterEach(cleanup);

const migration = readFileSync("supabase/migrations/20261116120000_client_showings.sql", "utf8");
const mark = (over: Partial<ClientShowing> = {}): ClientShowing => ({ id: "s1", workItemId: "w1", shownOn: "2026-11-12", occasion: null, ...over });

describe("the database holds the rules", () => {
  it("adds one table that nothing writes directly", () => {
    expect(migration).toContain("create table if not exists public.client_showings");
    expect(migration).toContain("enable row level security");
    expect(migration).toMatch(/for select to authenticated/);
    expect(migration).not.toMatch(/for (insert|update|delete|all)/);
  });

  it("lets only the owner or an editor in a company workspace mark, never coaches or guests", () => {
    expect(migration).toContain("public.org_has_firm_view(e.org_id)");
    expect(migration).toContain("not coalesce(p.is_guest, false)");
    expect(migration).toContain("me.role = 'coach'");
    expect(migration).toContain("e.owner_id = me.id or public.is_engagement_editor(p_engagement)");
    expect(migration.match(/public\.client_showing_actor\(/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("marks only work placed on the board and reads the content hash itself", () => {
    expect(migration).toContain("t.engagement_id = p_engagement");
    expect(migration).toContain("select w.id, w.org_id, w.content_hash into item");
    expect(migration).not.toMatch(/p_content_hash/);
  });

  it("only widens the analysis presets, keeping every existing one", () => {
    for (const preset of ["ai_fluency_4d", "span_provenance", "work_artifact", "archive_search", "decision_origin_thread", "red_pen", "partner_read"]) {
      expect(migration).toContain(`'${preset}'`);
    }
    expect(migration).not.toMatch(/drop table|drop column|alter column/i);
  });
});

describe("the rules people see", () => {
  it("marks deliverables only", () => {
    expect(canMarkShown("deck")).toBe(true);
    expect(canMarkShown("document")).toBe(true);
    expect(canMarkShown("ai_thread")).toBe(false);
    expect(canMarkShown(undefined)).toBe(false);
  });

  it("refuses a future date and a long occasion", () => {
    expect(validateShowing({ shownOn: "2026-11-17", occasion: "" }, "2026-11-16")).toBe(CLIENT_SHOWN_COPY.futureDate);
    expect(validateShowing({ shownOn: "2026-11-16", occasion: "x".repeat(121) }, "2026-11-16")).toBe(CLIENT_SHOWN_COPY.longOccasion);
    expect(validateShowing({ shownOn: "2026-11-12", occasion: "SteerCo 3" }, "2026-11-16")).toBeNull();
  });

  it("names one showing and counts several, latest first", () => {
    expect(shownLine([])).toBeNull();
    expect(shownLine([mark({ occasion: "SteerCo 3" })])).toBe("Shown to client, 12 Nov, SteerCo 3");
    expect(shownLine([mark({ id: "a", shownOn: "2026-10-02" }), mark({ id: "b", shownOn: "2026-11-12" })])).toBe("Shown to client 2 times, last 12 Nov");
  });

  it("groups rows by item", () => {
    const map = showingsByItem([
      { id: "a", work_item_id: "w1", shown_on: "2026-11-01", occasion: null },
      { id: "b", work_item_id: "w1", shown_on: "2026-11-12", occasion: "Final" },
      { id: "c", work_item_id: "w2", shown_on: "2026-11-03", occasion: null },
    ]);
    expect(map.get("w1")).toHaveLength(2);
    expect(map.get("w2")?.[0]?.id).toBe("c");
  });
});

describe("the dialog", () => {
  it("saves the date and occasion, and closes", async () => {
    const onMark = vi.fn(async () => {});
    const onOpenChange = vi.fn();
    render(<ClientShownDialog open onOpenChange={onOpenChange} marks={[]} onMark={onMark} onUnmark={async () => {}} />);
    fireEvent.change(screen.getByPlaceholderText(CLIENT_SHOWN_COPY.occasionPlaceholder), { target: { value: "Kickoff" } });
    fireEvent.click(screen.getByRole("button", { name: CLIENT_SHOWN_COPY.save }));
    await waitFor(() => expect(onMark).toHaveBeenCalledWith(expect.objectContaining({ occasion: "Kickoff" })));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("lists earlier marks and removes one", async () => {
    const onUnmark = vi.fn(async () => {});
    render(<ClientShownDialog open onOpenChange={() => {}} marks={[mark({ occasion: "SteerCo 3" })]} onMark={async () => {}} onUnmark={onUnmark} />);
    expect(screen.getByText("12 Nov, SteerCo 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: CLIENT_SHOWN_COPY.remove }));
    await waitFor(() => expect(onUnmark).toHaveBeenCalled());
  });

  it("says so when saving fails", async () => {
    render(<ClientShownDialog open onOpenChange={() => {}} marks={[]} onMark={async () => { throw new Error("no"); }} onUnmark={async () => {}} />);
    fireEvent.click(screen.getByRole("button", { name: CLIENT_SHOWN_COPY.save }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", CLIENT_SHOWN_COPY.failed);
  });
});

describe("the board", () => {
  const noop = () => {};
  const menu = (extra: Record<string, unknown>) => render(<LabCardMenu selected={false} canBranch={false} local={false} open onOpenChange={noop} cardRef={{ current: null }} onSelect={noop} onOpen={noop} onBranch={noop} onHide={noop} onDelete={noop} {...extra} />);

  it("shows the menu entry only when the board passes it", () => {
    menu({});
    expect(screen.queryByText(CLIENT_SHOWN_COPY.menu)).toBeNull();
    cleanup();
    const onClientShown = vi.fn();
    menu({ clientShownLabel: CLIENT_SHOWN_COPY.menu, onClientShown });
    fireEvent.click(screen.getByText(CLIENT_SHOWN_COPY.menu));
    expect(onClientShown).toHaveBeenCalled();
  });

  it("renders the line from marks and nothing without them", () => {
    const { container } = render(<ClientShownLine marks={[]} />);
    expect(container.textContent).toBe("");
    render(<ClientShownLine marks={[mark()]} />);
    expect(screen.getByText("Shown to client, 12 Nov")).toBeTruthy();
  });

  it("is passed only by the signed-in board, never by shared, demo, tour or firm surfaces", () => {
    const passers = execSync("grep -rl 'clientShownMarks=' src --include=*.tsx").toString().trim().split("\n").filter((file) => !file.includes("__tests__"));
    expect(passers).toEqual(["src/pages/CanvasLabPage.tsx"]);
    const lineUsers = execSync("grep -rl 'ClientShownLine' src --include=*.tsx").toString().trim().split("\n").filter((file) => !file.includes("__tests__")).sort();
    expect(lineUsers).toEqual(["src/components/canvas-lab/ClientShownLine.tsx", "src/components/canvas-lab/LabCard.tsx"]);
  });

  it("is limited to workspaces with a firm view, with no flag in front, and records content-free events", () => {
    expect(Object.keys(FEATURE_FLAGS)).not.toContain("company-brain");
    const hook = readFileSync("src/hooks/use-client-showings.ts", "utf8");
    expect(hook).not.toContain("useFeatureFlag");
    expect(hook).toContain("profileHasFirmView");
    expect(EVENT_DIM_KEYS["client_showing.marked"]).toEqual(["has_occasion", "item_type"]);
    expect(EVENT_DIM_KEYS["client_showing.unmarked"]).toEqual([]);
  });
});
