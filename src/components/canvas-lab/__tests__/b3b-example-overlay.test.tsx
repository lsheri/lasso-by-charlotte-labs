// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/components/canvas-lab/canvas-lab-telemetry", () => ({
  noteWorkboardReviewOpened: vi.fn(),
  noteWorkboardTrailSelected: vi.fn(),
  noteWorkboardExampleViewed: vi.fn(),
  noteWorkboardCardMenuOpened: vi.fn(),
}));

import { ExampleBoardOverlay } from "@/components/canvas-lab/ExampleBoardOverlay";
import * as telemetry from "@/components/canvas-lab/canvas-lab-telemetry";
import { logEvent } from "@/lib/telemetry";

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = TestResizeObserver;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the example board overlay", () => {
  it("shows no ownership label on any sample card", () => {
    render(<ExampleBoardOverlay onClose={() => undefined} />);
    for (const word of ["YOURS", "yours", "teammate", "local draft"]) {
      expect(screen.queryAllByText(word)).toHaveLength(0);
    }
    expect(screen.getByText("northwind-pricing-deck-v3.pptx")).toBeTruthy();
  });

  it("opens the sample trail from the button and from the deck card, and closes back to the example", () => {
    render(<ExampleBoardOverlay onClose={() => undefined} />);
    fireEvent.click(screen.getByTestId("example-what-fed-this"));
    expect(screen.getByTestId("canvas-lab-example-review")).toBeTruthy();
    fireEvent.click(screen.getByText("Back to the example"));
    expect(screen.queryByTestId("canvas-lab-example-review")).toBeNull();
    fireEvent.click(screen.getByLabelText("What fed northwind-pricing-deck-v3.pptx"));
    expect(screen.getByTestId("canvas-lab-example-review")).toBeTruthy();
  });

  it("sends no event of any kind while the sample trail is open", () => {
    render(<ExampleBoardOverlay onClose={() => undefined} />);
    fireEvent.click(screen.getByTestId("example-what-fed-this"));
    expect(telemetry.noteWorkboardReviewOpened).not.toHaveBeenCalled();
    expect(telemetry.noteWorkboardTrailSelected).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("holds the sample board clear of text selection", () => {
    render(<ExampleBoardOverlay onClose={() => undefined} />);
    expect(screen.getByTestId("canvas-lab-example-stage").className).toContain("[user-select:none]");
  });
});
