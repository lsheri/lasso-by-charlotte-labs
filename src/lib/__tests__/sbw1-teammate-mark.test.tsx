// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { LabCard } from "@/components/canvas-lab/LabCard";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { initialsOf } from "@/lib/initials";
import { teammateMarkFor } from "@/lib/teammate-mark";

vi.mock("@/components/canvas-lab/LabCardMenu", () => ({ LabCardMenu: () => null }));
vi.mock("@/components/canvas-lab/ChatLinkDialog", () => ({ CHAT_LINK_COPY: { add: "Add", change: "Change" }, ChatLinkDialog: () => null }));

const node: LabNode = {
  id: "node-1",
  kind: "brief",
  frame: null,
  title: "A card",
  summary: "A summary",
  typeLabel: "brief",
  ownership: "teammate",
  x: 0,
  y: 0,
  width: 260,
  height: 220,
};

const noop = () => undefined;

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as typeof ResizeObserver;
});

function renderCard(teammateMark?: { name: string | null; initials: string | null } | null) {
  const markProps = teammateMark === undefined ? {} : { teammateMark };
  return render(
    <LabCard
      node={node}
      selected={false}
      focused={false}
      onSelect={noop}
      onOpen={noop}
      onBranch={noop}
      onHide={noop}
      onDelete={noop}
      onEdit={noop}
      onEditCommitted={noop}
      connecting={false}
      connectSourceAnchor={null}
      onAnchorPointerDown={noop}
      onAnchorActivate={noop}
      onMenuOpened={noop}
      onMenuOpenChange={noop}
      onMeasure={noop}
      onPointerDown={noop}
      onFocus={noop}
      onKeyDown={noop}
      canResize={false}
      onResizeStart={noop}
      onFit={noop}
      onResizeKeyDown={noop}
      onResizeKeyUp={noop}
      frameChoices={[]}
      structured={false}
      onMoveToFrame={noop}
      {...markProps}
    />,
  );
}

afterEach(cleanup);

describe("SB-W1 teammate marks", () => {
  it("keeps the shared initials behavior", () => {
    expect(initialsOf("Liam Sheridan")).toBe("LS");
    expect(initialsOf("")).toBe("?");
  });

  it("resolves only teammate owners found in readable members", () => {
    const members = [{ id: "sam", display_name: "Sam Rivera" }];
    expect(teammateMarkFor({ ownership: "yours", ownerProfileId: "sam", members })).toBeNull();
    expect(teammateMarkFor({ ownership: "teammate", ownerProfileId: "sam", members })).toEqual({ name: "Sam Rivera", initials: "SR" });
    expect(teammateMarkFor({ ownership: "teammate", ownerProfileId: "other", members })).toEqual({ name: null, initials: null });
  });

  it("renders the shadow class, initials, and exact person tooltip", () => {
    const { container } = renderCard({ name: "Sam Rivera", initials: "SR" });
    expect(container.querySelector(".canvas-lab-card")?.classList.contains("canvas-lab-card-teammate")).toBe(true);
    const tag = container.querySelector(".canvas-lab-teammate-tag");
    expect(tag?.textContent).toBe("SR");
    expect(tag?.getAttribute("role")).toBe("img");
    expect(tag?.getAttribute("aria-label")).toMatch(/^Added by Sam Rivera/);
    expect(tag?.getAttribute("title")).toMatch(/^Added by Sam Rivera/);
  });

  it("lets the tag receive pointer events so its tooltip can show", () => {
    const styles = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
    const start = styles.indexOf(".canvas-lab-teammate-tag {");
    expect(start).toBeGreaterThan(-1);
    const rule = styles.slice(start, styles.indexOf("}", start));
    expect(rule).toContain("pointer-events: auto");
  });

  it("keeps the shadow without a tag when the member name is unavailable", () => {
    const { container } = renderCard({ name: null, initials: null });
    expect(container.querySelector(".canvas-lab-card")?.classList.contains("canvas-lab-card-teammate")).toBe(true);
    expect(container.querySelector(".canvas-lab-teammate-tag")).toBeNull();
  });

  it("leaves an unmarked card unchanged", () => {
    const { container } = renderCard();
    expect(container.querySelector(".canvas-lab-card")?.classList.contains("canvas-lab-card-teammate")).toBe(false);
    expect(container.querySelector(".canvas-lab-teammate-tag")).toBeNull();
  });

  it("keeps public, demo, and tour LabCard callers free of teammate marks", async () => {
    const modules = await Promise.all([
      import("@/components/canvas-lab/SharedBoardView?raw"),
      import("@/components/demo/DemoWorkboardSandbox?raw"),
      import("@/components/tour/TourBoard?raw").catch(() => ({ default: "" })),
    ]);
    for (const module of modules) expect(module.default).not.toContain("teammateMark");
  });
});