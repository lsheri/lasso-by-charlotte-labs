// @vitest-environment jsdom
// 20 Nov 2026: Back closes an open dialog and never leaves the page.
import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBackCloses } from "@/hooks/use-back-closes";

function Probe({ open, onClose }: { open: boolean; onClose: () => void }) {
  useBackCloses(open, onClose);
  return null;
}

const marked = () => Boolean((window.history.state as Record<string, unknown> | null)?.["__backCloses"]);
/** What the browser does on Back: the entry under ours becomes current, then popstate fires. */
function pressBack(under: unknown) {
  window.history.replaceState(under, "");
  window.dispatchEvent(new PopStateEvent("popstate", { state: under }));
}

describe("useBackCloses", () => {
  let push: ReturnType<typeof vi.spyOn>;
  let back: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState({ key: "k", __TSR_index: 3 }, "");
    push = vi.spyOn(window.history, "pushState");
    back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("adds nothing while closed and one entry when opened, keeping the router's state", () => {
    const view = render(<Probe open={false} onClose={vi.fn()} />);
    expect(push).not.toHaveBeenCalled();
    view.rerender(<Probe open onClose={vi.fn()} />);
    view.rerender(<Probe open onClose={vi.fn()} />);
    expect(push).toHaveBeenCalledTimes(1);
    expect(window.history.state).toMatchObject({ key: "k", __TSR_index: 4 });
    expect(marked()).toBe(true);
    expect(window.location.pathname).toBe("/");
  });

  it("closes on Back, once, and does not step back again", () => {
    const onClose = vi.fn();
    const view = render(<Probe open onClose={onClose} />);
    act(() => pressBack({ key: "k", __TSR_index: 3 }));
    expect(onClose).toHaveBeenCalledTimes(1);
    view.rerender(<Probe open={false} onClose={onClose} />);
    vi.runAllTimers();
    expect(back).not.toHaveBeenCalled();
  });

  it("takes its entry out when closed another way", () => {
    const onClose = vi.fn();
    const view = render(<Probe open onClose={onClose} />);
    view.rerender(<Probe open={false} onClose={onClose} />);
    vi.runAllTimers();
    expect(back).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cleans up when unmounted while open, and stops listening", () => {
    const onClose = vi.fn();
    const view = render(<Probe open onClose={onClose} />);
    view.unmount();
    vi.runAllTimers();
    expect(back).toHaveBeenCalledTimes(1);
    pressBack({ key: "k", __TSR_index: 3 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("never steps back when the page has already moved on", () => {
    const view = render(<Probe open onClose={vi.fn()} />);
    window.history.pushState({ key: "other", __TSR_index: 5 }, "", "/elsewhere");
    view.unmount();
    vi.runAllTimers();
    expect(back).not.toHaveBeenCalled();
    window.history.replaceState(null, "", "/");
  });

  it("pushes once under strict mode's double effect and does not close itself", () => {
    const onClose = vi.fn();
    render(
      <StrictMode>
        <Probe open onClose={onClose} />
      </StrictMode>,
    );
    vi.runAllTimers();
    expect(push).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
