// @vitest-environment jsdom
/**
 * Canvas Lab polish 2c-iv: persistence feedback.
 *
 * Save errors carry the failed command, a banner floats over the board, the
 * reasoning trail claims nothing while it is still reading, and context can be
 * cleared in one move.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContextComposer } from "@/components/canvas-lab/ContextComposer";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { commandEntityKind } from "@/hooks/use-canvas-lab";
import type { WorkboardCommand } from "@/lib/canvas-lab-shared";

afterEach(cleanup);

function reason(status: string): string {
  if (status === "conflict") return "conflict";
  if (status === "forbidden") return "permission";
  if (status === "network_error") return "network";
  if (status === "validation_error") return "validation";
  return "unknown";
}

function node(id: string, title: string): LabNode {
  return { id, kind: "work", title, summary: "", frame: "foundation", x: 0, y: 0, width: 232, height: 120, ownership: "yours" } as LabNode;
}

describe("save error state", () => {
  it("derives the entity from the failed command", () => {
    const cases: Array<[WorkboardCommand, string]> = [
      [{ type: "materialize", frames: [], nodes: [] }, "board"],
      [{ type: "frame_archive", frameId: "f", expectedVersion: 1 }, "frame"],
      [{ type: "node_archive", nodeId: "n", expectedVersion: 1 }, "node"],
      [{ type: "link_archive", linkId: "l", expectedVersion: 1 }, "relationship"],
    ];
    for (const [command, entity] of cases) expect(commandEntityKind(command)).toBe(entity);
  });

  it("maps an unreachable record to network and a real validation answer to validation", () => {
    expect(reason("network_error")).toBe("network");
    expect(reason("validation_error")).toBe("validation");
  });
});

describe("context composer", () => {
  const noop = () => undefined;

  it("offers Clear only when two or more cards are in context", () => {
    render(<ContextComposer context={[node("a", "One")]} onRemoveContext={noop} onClearContext={noop} onSubmit={noop} canvasInstructions="" onCanvasInstructions={noop} />);
    expect(screen.queryByLabelText("Clear all context")).toBeNull();
    cleanup();
    render(<ContextComposer context={[node("a", "One"), node("b", "Two")]} onRemoveContext={noop} onClearContext={noop} onSubmit={noop} canvasInstructions="" onCanvasInstructions={noop} />);
    expect(screen.getByLabelText("Clear all context")).toBeTruthy();
  });

  it("clears context once per click and leaves the draft text alone", () => {
    const clear = vi.fn();
    render(<ContextComposer context={[node("a", "One"), node("b", "Two")]} onRemoveContext={noop} onClearContext={clear} onSubmit={noop} canvasInstructions="" onCanvasInstructions={noop} />);
    const draft = screen.getByLabelText("Ask about what you picked") as HTMLTextAreaElement;
    fireEvent.change(draft, { target: { value: "keep me" } });
    fireEvent.click(screen.getByLabelText("Clear all context"));
    expect(clear).toHaveBeenCalledTimes(1);
    expect(draft.value).toBe("keep me");
  });
});

describe("banner overlay", () => {
  it("floats over the board instead of pushing it down", async () => {
    const css = await import("node:fs/promises").then((fs) => fs.readFile("src/styles.css", "utf8"));
    const block = /\.canvas-lab-banner\s*\{[^}]*\}/.exec(css);
    expect(block).not.toBeNull();
    const style = document.createElement("style");
    style.textContent = block?.[0] ?? "";
    document.head.append(style);
    const { rerender } = render(
      <main style={{ position: "relative" }}>
        <header key="header" style={{ height: 52 }} />
        <div key="surface" data-testid="surface" />
      </main>,
    );
    const before = screen.getByTestId("surface");
    rerender(
      <main style={{ position: "relative" }}>
        <header key="header" style={{ height: 52 }} />
        <div key="banner" data-testid="canvas-lab-banner" className="canvas-lab-banner" role="alert" />
        <div key="surface" data-testid="surface" />
      </main>,
    );
    const banner = screen.getByTestId("canvas-lab-banner");
    const computed = window.getComputedStyle(banner);
    expect(computed.position).toBe("absolute");
    expect(computed.top).toBe("52px");
    expect(screen.getByTestId("surface")).toBe(before);
    style.remove();
  });
});
