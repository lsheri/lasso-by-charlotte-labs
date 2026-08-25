// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { scribblePath } from "@/lib/journey-path";
import { PencilScribble } from "@/components/notebook/marks";

afterEach(cleanup);

const shipMock = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@/hooks/use-shipped-work", () => ({
  useShipWork: () => ({ mutateAsync: shipMock.run, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { ShipToFirmDialog } from "@/components/work/ShipToFirmDialog";

function setReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe("pass 116: the scribble generator", () => {
  it("is byte-identical for the same arguments", () => {
    const a = scribblePath(220, 24, "w1");
    const b = scribblePath(220, 24, "w1");
    expect(a.d).toBe(b.d);
    expect(a.len).toBe(b.len);
    expect(scribblePath(220, 24, "w2").d).not.toBe(a.d);
  });

  it("carries its own length, because jsdom has no getTotalLength", () => {
    const { len } = scribblePath(200, 20, "seed");
    render(<PencilScribble width={200} height={20} seed="seed" />);
    const path = screen.getByTestId("pencil-scribble-path");
    expect(path.getAttribute("stroke-dasharray")).toBe(String(len));
    expect(path.getAttribute("stroke-dashoffset")).toBe(String(len));
  });

  it("rests drawn, with no animation, under reduced motion", () => {
    render(<PencilScribble width={200} height={20} seed="seed" skipped />);
    const path = screen.getByTestId("pencil-scribble-path");
    expect(path.getAttribute("stroke-dashoffset")).toBe("0");
    expect(path.getAttribute("style") ?? "").not.toContain("animation");
  });
});

describe("pass 116: the ship dialog crosses the work off", () => {
  it("never closes before the scribble is done, then closes once", async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    let resolveShip: (() => void) | null = null;
    shipMock.run.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveShip = resolve;
        }),
    );
    const onOpenChange = vi.fn();
    render(
      <ShipToFirmDialog
        workItemId="w1"
        title="Q2 board deck"
        engagementId="e1"
        open
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.click(screen.getByText("Ship it"));
    expect(screen.getByText("Shipping…")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId("pencil-scribble")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(onOpenChange).not.toHaveBeenCalled();
    await act(async () => {
      resolveShip?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    vi.useRealTimers();
  });

  it("removes the scribble and re-enables the buttons when the server refuses", async () => {
    setReducedMotion(false);
    shipMock.run.mockRejectedValue(new Error("That work is not available to you."));
    render(
      <ShipToFirmDialog
        workItemId="w2"
        title="Q2 board deck"
        engagementId="e1"
        open
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Ship it"));
    await waitFor(() => expect(screen.getByTestId("ship-error")).toBeTruthy());
    expect(document.querySelector('[data-testid="pencil-scribble"]')).toBeNull();
    expect(screen.getByText("Ship it")).toBeTruthy();
  });
});

describe("pass 116.1: a failed ship leaves no pencil behind", () => {
  it("never draws when the server rejects before the settle timer", async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    shipMock.run.mockRejectedValue(new Error("nope"));
    const onOpenChange = vi.fn();
    render(
      <ShipToFirmDialog
        workItemId="w3"
        title="Q2 board deck"
        engagementId="e1"
        open
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.click(screen.getByText("Ship it"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("ship-error")).toBeTruthy();
    for (const step of [120, 300, 720, 1200]) {
      act(() => {
        vi.advanceTimersByTime(step);
      });
      expect(document.querySelector('[data-testid="pencil-scribble"]')).toBeNull();
    }
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText("Ship it")).toBeTruthy();
    vi.useRealTimers();
  });

  it("removes the pencil for good when the server rejects mid draw", async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    let rejectShip: ((error: Error) => void) | null = null;
    shipMock.run.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectShip = reject;
        }),
    );
    const onOpenChange = vi.fn();
    render(
      <ShipToFirmDialog
        workItemId="w4"
        title="Q2 board deck"
        engagementId="e1"
        open
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.click(screen.getByText("Ship it"));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByTestId("pencil-scribble")).toBeTruthy();
    await act(async () => {
      rejectShip?.(new Error("nope"));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    for (const step of [100, 720, 1200]) {
      act(() => {
        vi.advanceTimersByTime(step);
      });
      expect(document.querySelector('[data-testid="pencil-scribble"]')).toBeNull();
    }
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("ship-error")).toBeTruthy();
    vi.useRealTimers();
  });
});
