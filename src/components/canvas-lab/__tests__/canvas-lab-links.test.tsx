// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabLinkRejection } from "@/components/canvas-lab/LabLinkRejection";
import { LabRelationships } from "@/components/canvas-lab/LabRelationships";
import { linkRemovalAnnouncement, type LabLink, type LabNode } from "@/components/canvas-lab/canvas-lab-model";

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
    const { container } = render(<svg><LabRelationships links={[link, { ...link, id: "reverse", fromId: "b", toId: "a" }]} nodes={nodes} measuredHeights={new Map()} selectedLinkId={null} inverseZoom={2} editable onSelect={() => undefined} onRemove={() => undefined} /></svg>);
    const lines = container.querySelectorAll(".canvas-lab-relationship-line");
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line.getAttribute("marker-end")).toBe("url(#canvas-lab-arrow-graphite)");
  });

  it("shows the remove control on hover and removes once through the supplied path", () => {
    const remove = vi.fn();
    const { container } = render(<svg><LabRelationships links={[link]} nodes={nodes} measuredHeights={new Map()} selectedLinkId={null} inverseZoom={1} editable onSelect={() => undefined} onRemove={remove} /></svg>);
    expect(screen.queryByRole("button", { name: "Remove relationship from Source to Target" })).toBeNull();
    const group = container.querySelector("[data-testid='lab-relationship-link']");
    expect(group).not.toBeNull();
    if (!group) return;
    fireEvent.pointerEnter(group);
    const button = screen.getByRole("button", { name: "Remove relationship from Source to Target" });
    fireEvent.click(button);
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith(link);
  });

  it("never offers removal to a read-only viewer", () => {
    const { container } = render(<svg><LabRelationships links={[link]} nodes={nodes} measuredHeights={new Map()} selectedLinkId="link" inverseZoom={1} editable={false} onSelect={() => undefined} onRemove={() => undefined} /></svg>);
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
});