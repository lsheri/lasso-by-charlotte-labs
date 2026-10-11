// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkSubtitle } from "@/components/work/WorkSubtitle";
import { WorkNote } from "@/components/work/WorkNote";
import type { WorkItemRow } from "@/lib/work-types";

vi.mock("@/hooks/use-connector-accounts", () => ({ useConnectorAccounts: () => ({ data: {} }) }));
afterEach(cleanup);

describe("MOB-1 phone work presentation", () => {
  it("below 768 renders separate subtitle parts and gates selection and canvas controls out of the DOM", async () => {
    const width = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    try {
      const { container } = render(<WorkSubtitle pieces={77} unmapped={5} />);
      await waitFor(() => expect(container.querySelector('[data-work-subtitle="parts"]')).not.toBeNull());
      const parts = container.querySelector('[data-work-subtitle="parts"]');
      expect(Array.from(parts?.children ?? []).map((part) => part.textContent)).toEqual(["77 pieces of work", "5 with no board", "0 tools connected"]);
      expect(parts?.textContent).not.toContain(" · ");
      const page = readFileSync("src/pages/WorkPage.tsx", "utf8");
      expect(page).toContain("!isMobile && !isCoach && selectable.length > 0 && !selectMode");
      expect(page).toMatch(/\) : isMobile \? \([\s\S]*?work-phone-list[\s\S]*?\) : all.length === 0 \? \([\s\S]*?<BoardShell/);
      expect(page.slice(page.indexOf('className="work-phone-list"'), page.indexOf(') : all.length === 0 ? ('))).not.toMatch(/BoardShell|showViewControls|Select/);
      expect(screen.queryByRole("button", { name: "Select" })).toBeNull();
      expect(screen.queryByRole("group", { name: "Board zoom" })).toBeNull();
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    }
  });

  it("keeps the desktop joined subtitle and restricts all added styles to the phone breakpoint", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const { container } = render(<WorkSubtitle pieces={77} unmapped={5} />);
    expect(container.textContent).toBe("77 pieces of work · 5 with no board · 0 tools connected");
    expect(container.querySelector('[data-work-subtitle="parts"]')).toBeNull();
    const styles = readFileSync("src/styles.css", "utf8");
    const phone = styles.slice(styles.indexOf("/* All work phone presentation."), styles.indexOf("@layer nb {"));
    expect(phone).toContain("@media (max-width: 767px)");
    expect(phone).not.toContain("outline: none");
    expect(phone).toContain("min-height: 88px");
  });

  it("reuses WorkNote with the same title, date, type and opener but without summary or link", () => {
    const onOpen = vi.fn();
    const item = { id: "piece", title: "A piece of work", type: "document", visibility: "unmapped", captured_at: "2026-10-11T02:00:00Z", work_item_tasks: [], meta: null } as unknown as WorkItemRow;
    render(<WorkNote item={item} phoneRow onOpen={onOpen} />);
    const row = screen.getByRole("button", { name: item.title });
    expect(row.textContent).toContain("Document · NO BOARD");
    expect(row.querySelector("a")).toBeNull();
    expect(row.textContent).not.toContain("No summary available.");
    row.click();
    expect(onOpen).toHaveBeenCalledOnce();
  });
});