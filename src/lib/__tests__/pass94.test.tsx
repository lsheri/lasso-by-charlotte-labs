// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WorkPile } from "@/components/work/WorkPile";
import { SCATTER_CAP, scatterFor } from "@/components/work/pile-scatter";
import type { WorkItemRow } from "@/lib/work-types";

afterEach(cleanup);

const read = (path: string) => readFileSync(path, "utf8");

function item(id: string, type: WorkItemRow["type"], title: string): WorkItemRow {
  return {
    id,
    title,
    type,
    source: "upload",
    visibility: "unmapped",
    captured_at: "2026-08-01T00:00:00Z",
    content_ref: null,
    work_item_tasks: [],
  } as unknown as WorkItemRow;
}

describe("94.1 work picker in the analyses tab", () => {
  const surface = read("src/components/reflect/AskSurface.tsx");
  const picker = read("src/components/reflect/WorkScopePicker.tsx");
  const hook = read("src/components/reflect/use-ask-lasso.ts");
  const shared = read("src/components/reflect/MappedWorkChecklist.tsx");

  it("selects every mapped item by default when the chat opens", () => {
    expect(hook).toContain("setSelected(new Set(mapped.map((i) => i.id)))");
  });

  it("uses one shared checklist rather than a forked near copy", () => {
    expect(shared).toContain("export function MappedWorkChecklist");
    expect(shared).toContain("export function groupByTask");
    expect(surface).toContain("MappedWorkChecklist");
    expect(picker).toContain("MappedWorkChecklist");
    expect(picker).not.toContain("function groupByTask");
  });

  it("puts a quiet change affordance above the chips", () => {
    expect(surface).toContain("All work in this engagement");
    expect(surface).toContain("· Change");
    expect(surface).toContain("SelectionAnalysisChips");
  });
});

describe("94.2 tab swap", () => {
  const surface = read("src/components/reflect/AskSurface.tsx");
  const state = read("src/components/reflect/ask-dock-state.tsx");
  const lens = read("src/components/reflect/AnalysisLens.tsx");

  it("drops the analyse engagement tab and its embedded lens mount", () => {
    expect(state).not.toContain('"analyse"');
    expect(surface).not.toContain("Analyse engagement");
    expect(surface).not.toContain("AnalysisLens");
  });

  it("adds a New chat action that starts a fresh session on Messages", () => {
    expect(surface).toContain("New chat");
    expect(surface).toContain('name="plus"');
    expect(surface).toContain("ask.newSession();");
    expect(surface).toContain('onTab("messages")');
  });

  it("removes the embedded prop now that no mount uses it", () => {
    expect(lens).not.toContain("embedded");
  });

  it("stops threading itemCount through the dock", () => {
    for (const path of [
      "src/components/reflect/AskSurface.tsx",
      "src/components/reflect/AskDock.tsx",
      "src/components/reflect/AskSheet.tsx",
      "src/components/reflect/ReflectDock.tsx",
    ]) {
      expect(read(path)).not.toContain("itemCount");
    }
  });
});

describe("94.3 scatter positions", () => {
  it("is deterministic per id", () => {
    expect(scatterFor("abc")).toEqual(scatterFor("abc"));
  });

  it("gives distinct ids distinct places", () => {
    const a = scatterFor("item-one");
    const b = scatterFor("item-two");
    expect(`${a.dx},${a.dy},${a.rot}`).not.toBe(`${b.dx},${b.dy},${b.rot}`);
  });

  it("stays inside the field and under three degrees", () => {
    for (const id of ["a", "b", "c", "long-uuid-1234", "zz"]) {
      const { dx, dy, rot } = scatterFor(id);
      expect(Math.abs(dx)).toBeLessThanOrEqual(19);
      expect(Math.abs(dy)).toBeLessThanOrEqual(15);
      expect(Math.abs(rot)).toBeLessThanOrEqual(3);
    }
  });
});

describe("94.3 scatter field", () => {
  const many = Array.from({ length: 34 }, (_, i) => item(`i${i}`, "document", `Note ${i}`));

  it("shows one paper per item and caps the field at thirty", () => {
    render(<WorkPile entries={many} renderEntry={(e) => <div>{(e as WorkItemRow).title}</div>} />);
    expect(SCATTER_CAP).toBe(30);
    expect(screen.getByText("Note 0")).toBeTruthy();
    expect(screen.queryByText("Note 33")).toBeNull();
    expect(screen.getByText("+ 4 more")).toBeTruthy();
    expect(screen.getByText("34 unmapped")).toBeTruthy();
  });

  it("still resolves into the type matrix from the toggle", () => {
    render(
      <WorkPile
        entries={[item("a", "document", "Scope note"), item("b", "deck", "Steerco deck")]}
        renderEntry={(e) => <div>{(e as WorkItemRow).title}</div>}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Matrix" }));
    expect(screen.getByText("Documents")).toBeTruthy();
    expect(screen.getByText("Steerco deck")).toBeTruthy();
  });
});

describe("94.3 scatter css", () => {
  const css = read("src/styles.css");

  it("clamps the title to two lines and ships the paper classes", () => {
    expect(css).toContain(".nb-paper-title");
    expect(css).toContain("-webkit-line-clamp: 2");
    expect(css).toContain(".nb-scatter");
    expect(css).not.toContain('.nb-pile-card[data-stacked="1"]');
  });

  it("organises on hover, well under half a second", () => {
    expect(css).toContain('.nb-scatter[data-scatter="1"]:hover .nb-paper');
    expect(css).toContain("transform 340ms var(--nb-ease)");
  });

  it("renders the organised grid on touch and under reduced motion", () => {
    const base = css.indexOf('.nb-scatter[data-scatter="1"] .nb-paper');
    expect(base).toBeGreaterThan(0);
    // The responsive override must come after the base rule it overrides.
    expect(css.indexOf("@media (max-width: 767px)", base)).toBeGreaterThan(base);
    const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain(".nb-paper");
    expect(reduced).toContain("transform: none !important");
  });
});
