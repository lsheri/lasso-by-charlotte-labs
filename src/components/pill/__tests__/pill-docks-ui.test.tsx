// @vitest-environment jsdom
// 21 Nov 2026, chat pill Phase 1c: the landing chat and the spots.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PillDockSpots } from "@/components/pill/PillDockSpots";
import { PillLanding } from "@/components/pill/PillLanding";
import { PILL_COPY, PILL_DOCK_COPY } from "@/lib/chat-pill-shared";

afterEach(cleanup);

describe("the landing chat", () => {
  it("greets, hints and asks; a short question does not go", () => {
    const onAsk = vi.fn();
    render(<PillLanding firstName="Maren" brandName="Charlotte" welcome="Welcome words" hint="Paste a brief" onAsk={onAsk} onHandleDown={() => undefined} onHandleClick={() => undefined} />);
    expect(screen.getByText(PILL_COPY.hello("Maren"))).toBeTruthy();
    const box = screen.getByLabelText(PILL_COPY.label) as HTMLTextAreaElement;
    expect(box.placeholder).toBe("Paste a brief");
    fireEvent.change(box, { target: { value: "hi" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onAsk).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: "How did we price the Larkspur work?" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onAsk).toHaveBeenCalledWith("How did we price the Larkspur work?");
    expect(box.value).toBe("");
  });
  it("has the six-dot handle with its words", () => {
    const onHandleDown = vi.fn();
    render(<PillLanding firstName="Maren" brandName="Charlotte" welcome="" hint="" onAsk={() => undefined} onHandleDown={onHandleDown} onHandleClick={() => undefined} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: PILL_DOCK_COPY.handle }));
    expect(onHandleDown).toHaveBeenCalled();
  });
});

describe("QA fixes of PR 305", () => {
  it("the landing chat centres beside the menu's measured width (L3)", () => {
    render(<PillLanding firstName="Maren" brandName="Charlotte" railWidth={232} welcome="" hint="" onAsk={() => undefined} onHandleDown={() => undefined} onHandleClick={() => undefined} />);
    expect((document.querySelector("[data-pill-landing-chat]") as HTMLElement).style.getPropertyValue("--pill-landing-left")).toBe("232px");
  });
  it("a spot's name sits in its own small tag, not across the middle of the spot (L2)", () => {
    render(<PillDockSpots spots={[{ dock: "center", left: 400, top: 360, width: 640, height: 180 }]} active="center" current="center" picking={false} onPick={() => undefined} onClose={() => undefined} />);
    expect(document.querySelector('[data-spot="center"] .pill-spots__label')?.textContent).toBe(PILL_DOCK_COPY.spots.center);
  });
});

describe("the spots", () => {
  const spots = [
    { dock: "center" as const, left: 400, top: 360, width: 640, height: 180 },
    { dock: "top-right" as const, left: 1156, top: 24, width: 260, height: 64 },
    { dock: "bottom-right" as const, left: 1156, top: 812, width: 260, height: 64 },
  ];
  it("picking: each spot is a button; Escape keeps it where it is", () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<PillDockSpots spots={spots} active={null} current="center" picking onPick={onPick} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: PILL_DOCK_COPY.pick("Top right") }));
    expect(onPick).toHaveBeenCalledWith("top-right");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
  it("dragging: the nearest spot lights up and nothing is a button", () => {
    render(<PillDockSpots spots={spots} active="bottom-right" current="center" picking={false} onPick={() => undefined} onClose={() => undefined} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(document.querySelector('[data-spot="bottom-right"]')!.hasAttribute("data-active")).toBe(true);
  });
});
