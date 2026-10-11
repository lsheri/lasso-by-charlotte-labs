// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BoardShell } from "@/components/board/BoardShell";

afterEach(cleanup);

describe("Home native scroll opt-in", () => {
  it("leaves wheel scrolling to the browser and enables vertical touch scrolling", () => {
    render(<BoardShell frames={[]} nodes={[]} renderNode={() => null} lockZoom nativeScroll />);
    const shell = screen.getByTestId("board-shell");
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 500 });
    shell.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(shell.querySelector(".canvas-lab-surface")?.className).toContain("touch-pan-y");
    expect(screen.getByTestId("board-shell-stage").style.transform).toBe("translate(0px, 0px) scale(1)");
  });
});