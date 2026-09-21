// @vitest-environment jsdom
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DimmedDisabled } from "@/components/common/DimmedDisabled";
import { InboxFixedCard } from "@/components/work/InboxFixedCard";
import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";
import { inboxFilterDims, inboxFilterMatches } from "@/lib/inbox-filter";
import type { WorkItemRow } from "@/lib/work-types";

function item(id: string, visibility: WorkItemRow["visibility"], code?: string): WorkItemRow {
  return {
    id,
    title: id,
    type: "document",
    source: "upload",
    visibility,
    captured_at: "2026-09-21T10:00:00Z",
    content_ref: null,
    created_at_source: null,
    work_date: null,
    content_fidelity: "verbatim",
    source_vendor: null,
    orig_conversation_id: null,
    source_meta: null,
    meta: null,
    work_item_tasks: code
      ? [{ task_id: `${id}-task`, tasks: { id: `${id}-task`, name: "Work", engagement_id: `${id}-engagement`, engagements: { id: `${id}-engagement`, code, title: code } } }]
      : [],
  } as WorkItemRow;
}

function filesUnder(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const full = join(path, entry.name);
    return entry.isDirectory() ? filesUnder(full) : /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
  });
}

const rows = [item("mapped", "mapped", "ALPHA"), item("waiting", "unmapped"), item("other", "mapped", "BETA")];

afterEach(cleanup);

describe("CG1 inbox congruency", () => {
  it("keeps every item in place and dims only non-matches, including when nothing matches", () => {
    for (const filter of ["unmapped", "MISSING"]) {
      const matches = rows.map((row) => inboxFilterMatches(row, filter));
      const { unmount } = render(<>{rows.map((row, index) => <DimmedDisabled key={row.id} dimmed={!matches[index]}><span>{row.title}</span></DimmedDisabled>)}</>);
      expect(screen.getAllByText(/mapped|waiting|other/)).toHaveLength(rows.length);
      expect(screen.getAllByTestId("dimmed-disabled")).toHaveLength(matches.filter((match) => !match).length);
      unmount();
    }
  });

  it("uses the same dim-and-disable component in Find it and the Inbox", () => {
    const inbox = readFileSync("src/pages/WorkPage.tsx", "utf8");
    const findIt = readFileSync("src/components/find-it/FindItResults.tsx", "utf8");
    for (const source of [inbox, findIt]) expect(source).toContain("DimmedDisabled");
  });

  it("does not use green or lime to decide an Inbox filter match", () => {
    const source = readFileSync("src/pages/WorkPage.tsx", "utf8");
    const filterPath = source.slice(source.indexOf("const chipBase"), source.indexOf("return (", source.indexOf("const chipBase")));
    expect(filterPath).not.toMatch(/green|lime|lasso/i);
  });

  it("keeps Ask Lasso answers visually distinct from transient filter state", () => {
    const styles = readFileSync("src/styles.css", "utf8");
    const answer = styles.match(/\.canvas-lab-answer-card\s*\{[^}]+\}/)?.[0] ?? "";
    const dimmed = readFileSync("src/components/common/DimmedDisabled.tsx", "utf8");
    expect(answer).toContain("--nb-lasso-green");
    expect(dimmed).not.toMatch(/green|lime|lasso/i);
  });

  it("marks Inbox cards as fixed and cancels drag", () => {
    const onDragStart = vi.fn();
    render(<InboxFixedCard><span>Card</span></InboxFixedCard>);
    const card = screen.getByTestId("inbox-fixed-card");
    card.addEventListener("dragstart", onDragStart);
    expect(card.getAttribute("draggable")).toBe("false");
    expect(card.querySelector("[data-non-drag-affordance]"))not.toBeNull();
    expect(fireEvent.dragStart(card)).toBe(false);
    expect(onDragStart).toHaveBeenCalledOnce();
  });

  it("builds one closed event payload per change and preserves zero", () => {
    const selected = ["all", "one"] as const;
    const filters = ["placement", "engagement"] as const;
    for (const filter of filters) {
      for (const state of selected) {
        const dims = inboxFilterDims(filter, state, state === "all" ? rows.length : 0);
        expect(Object.keys(dims).sort()).toEqual([...EVENT_DIM_KEYS["work.filter_changed"]].sort());
        expect(filters).toContain(dims.filter);
        expect(selected).toContain(dims.selected);
        if (state === "one") expect(dims.result_band).toBe("0");
      }
    }
  });

  it("keeps filter decisions out of Inbox component styling helpers", () => {
    const offenders = filesUnder("src/components").filter((path) => {
      const source = readFileSync(path, "utf8");
      return /inbox[^\n]*(?:filter|match)[^\n]*(?:green|lime)|(?:green|lime)[^\n]*(?:filter|match)/i.test(source);
    });
    expect(offenders).toEqual([]);
  });
});
