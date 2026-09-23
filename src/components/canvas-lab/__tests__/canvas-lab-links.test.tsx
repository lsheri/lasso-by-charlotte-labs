// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabCard } from "@/components/canvas-lab/LabCard";
import { LabLinkRejection } from "@/components/canvas-lab/LabLinkRejection";
import { LabRelationshipOverlays } from "@/components/canvas-lab/LabRelationshipOverlays";
import { LabRelationships } from "@/components/canvas-lab/LabRelationships";
import { connectDisarmed, linkRemovalAnnouncement, type LabLink, type LabNode } from "@/components/canvas-lab/canvas-lab-model";

const nodes: LabNode[] = [
  { id: "a", kind: "work", frame: "f", title: "Source", summary: "", typeLabel: "document", ownership: "yours", x: 0, y: 0, width: 232, height: 112 },
  { id: "b", kind: "decision", frame: "f", title: "Target", summary: "", typeLabel: "call", ownership: "yours", x: 400, y: 120, width: 232, height: 112 },
];
const link: LabLink = { id: "link", fromId: "a", fromAnchor: "right", toId: "b", toAnchor: "left" };

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Workboard relationships", () => {
  it("draws an arrow marker for every relationship", () => {
    const { container } = render(<svg><LabRelationships links={[link, { ...link, id: "reverse", fromId: "b", toId: "a" }]} nodes={nodes} measuredHeights={new Map()} selectedLinkId={null} inverseZoom={2} onSelect={() => undefined} /></svg>);
    const lines = container.querySelectorAll(".canvas-lab-relationship-line");
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line.getAttribute("marker-end")).toBe("url(#canvas-lab-arrow-graphite)");
  });

  it("shows the remove control on hover and removes once through the supplied path", () => {
    const remove = vi.fn();
    const { container } = render(<svg><LabRelationships links={[link]} nodes={nodes} measuredHeights={new Map()} selectedLinkId={null} inverseZoom={1} onSelect={() => undefined} /></svg>);
    const group = container.querySelector("[data-testid='lab-relationship-link']");
    expect(group).not.toBeNull();
    if (!group) return;
    fireEvent.pointerEnter(group);
    render(<svg><LabRelationshipOverlays links={[link]} nodes={nodes} measuredHeights={new Map()} selectedLinkId={null} hoveredLinkId="link" inverseZoom={1} zoom={1} editable onRemove={remove} /></svg>);
    const button = screen.getByRole("button", { name: "Remove relationship from Source to Target" });
    fireEvent.click(button);
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith(link);
  });

  it("never offers removal to a read-only viewer", () => {
    const { container } = render(<svg><LabRelationshipOverlays links={[link]} nodes={nodes} measuredHeights={new Map()} selectedLinkId="link" hoveredLinkId={null} inverseZoom={1} zoom={1} editable={false} onRemove={() => undefined} /></svg>);
    expect(container.querySelector(".canvas-lab-relationship-remove")).toBeNull();
  });

  it("shows a rejection note and clears it after three seconds", () => {
    vi.useFakeTimers();
    const clear = vi.fn();
    render(<LabLinkRejection target={nodes[1] as LabNode} message="Already connected" onClear={clear} />);
    expect(screen.getByRole("status").textContent).toBe("Already connected");
    vi.advanceTimersByTime(3_000);
    expect(clear).toHaveBeenCalledOnce();
  });

  it("uses accurate durable and local removal announcements", () => {
    expect(linkRemovalAnnouncement(link)).toBe("Local relationship removed.");
    expect(linkRemovalAnnouncement({ ...link, durableId: "durable" })).toBe("Relationship removed from the workboard.");
  });

  it("activates an anchor with the keyboard without toggling card context", () => {
    globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as typeof ResizeObserver;
    const activate = vi.fn();
    const select = vi.fn();
    render(
      <LabCard
        node={{ id: "n", kind: "work", workItemId: "w", frame: "f", title: "Source", summary: "", typeLabel: "document", ownership: "yours", x: 0, y: 0, width: 232, height: 112 }}
        selected={false}
        focused
        connecting={false}
        connectSourceAnchor={null}
        canResize={false}
        onSelect={select}
        onOpen={() => undefined}
        onBranch={() => undefined}
        onHide={() => undefined}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onEditCommitted={() => undefined}
        onAnchorPointerDown={() => undefined}
        onAnchorActivate={activate}
        onMenuOpened={() => undefined}
        onMenuOpenChange={() => undefined}
        onMeasure={() => undefined}
        onPointerDown={() => undefined}
        onFocus={() => undefined}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") select(); }}
        onResizeStart={() => undefined}
        onFit={() => undefined}
        onResizeKeyDown={() => undefined}
        onResizeKeyUp={() => undefined}
        frameChoices={[]}
        structured
        onMoveToFrame={() => undefined}
      />,
    );
    const anchor = screen.getByRole("button", { name: "Connect from left" });
    anchor.focus();
    // Keydown on the anchor must not bubble into the card's context toggle.
    fireEvent.keyDown(anchor, { key: "Enter" });
    expect(select).not.toHaveBeenCalled();
    // The browser turns Enter on a focused button into a click, which activates the anchor.
    fireEvent.click(anchor);
    expect(activate).toHaveBeenCalledOnce();
    expect(activate).toHaveBeenCalledWith("left");
    expect(select).not.toHaveBeenCalled();
  });

  it("disarms the connect source when an attempt ends", () => {
    expect(connectDisarmed()).toEqual({ connectSource: null, interaction: "idle" });
  });
});