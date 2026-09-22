// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeBoard, IdeasNote, ideasMailto } from "@/components/home/HomeBoard";

const mocks = vi.hoisted(() => ({
  engagements: undefined as undefined | { id: string }[],
  emitClientEvent: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, onClick }: { children: React.ReactNode; to: string; onClick?: () => void }) => (
    <a href={to} onClick={onClick}>{children}</a>
  ),
}));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "profile-1", org_id: "org-1" } }),
}));

vi.mock("@/hooks/use-engagements", () => ({
  useEngagements: () => ({ data: mocks.engagements }),
}));

vi.mock("@/lib/client-telemetry", () => ({
  emitClientEvent: mocks.emitClientEvent,
}));

vi.mock("@/components/engagements/NewEngagementDialog", () => ({
  NewEngagementDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));

vi.mock("@/components/board/BoardShell", () => ({
  BoardShell: ({ toolbar, renderFrame }: { toolbar?: React.ReactNode; renderFrame?: () => React.ReactNode }) => (
    <div>{toolbar}{renderFrame?.()}</div>
  ),
}));

vi.mock("@/components/reflect/LassoThinkingMark", () => ({
  LassoThinkingMark: ({ kind, size }: { kind: string; size: number }) => (
    <span data-lasso-thinking-mark={kind} data-size={size} />
  ),
}));

afterEach(() => {
  cleanup();
  mocks.engagements = undefined;
  mocks.emitClientEvent.mockClear();
});

describe("Home", () => {
  it("shows only a real engagement count and exactly one title signature", () => {
    const first = render(<HomeBoard />);
    expect(screen.getByText("HOME")).toBeTruthy();
    expect(screen.queryByText(/HOME ·/)).toBeNull();
    first.unmount();

    mocks.engagements = [{ id: "one" }, { id: "two" }, { id: "three" }];
    render(<HomeBoard />);
    expect(screen.getByText("HOME · 3 ENGAGEMENTS")).toBeTruthy();
    expect(document.querySelectorAll('[data-lasso-thinking-mark="signature"]')).toHaveLength(1);
  });

  it("covers opening and both navigation actions without content dimensions", () => {
    mocks.engagements = [];
    render(<HomeBoard />);
    expect(mocks.emitClientEvent).toHaveBeenCalledWith("home.opened", {});

    fireEvent.click(screen.getByRole("button", { name: "New engagement" }));
    fireEvent.click(screen.getByRole("link", { name: "Past work" }));
    expect(mocks.emitClientEvent).toHaveBeenCalledWith("home.new_engagement_started", {});
    expect(mocks.emitClientEvent).toHaveBeenCalledWith("home.past_work_opened", {});
  });
});

describe("the ideas note", () => {
  it("enables Send only for text, composes an encoded email, and keeps the words", () => {
    const openMailClient = vi.fn();
    render(<IdeasNote openMailClient={openMailClient} />);
    const input = screen.getByPlaceholderText("What would make this better?") as HTMLInputElement;
    const send = screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;

    expect(send.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "Keep this & that?" } });
    expect(send.disabled).toBe(false);
    fireEvent.click(send);

    expect(openMailClient).toHaveBeenCalledWith("Keep this & that?");
    expect(ideasMailto("Keep this & that?")).toBe(
      "mailto:liam@charlotte-labs.com?subject=Lasso+product+idea&body=Keep+this+%26+that%3F",
    );
    expect(input.value).toBe("Keep this & that?");
    expect(mocks.emitClientEvent).toHaveBeenCalledWith("home.ideas_note_composed", {});
  });

  it("does not write the note to storage, call fetch, or pass the words into the event helper", () => {
    const openMailClient = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const localWrite = vi.spyOn(Storage.prototype, "setItem");
    const sessionWrite = vi.spyOn(window.sessionStorage, "setItem");
    render(<IdeasNote openMailClient={openMailClient} />);

    fireEvent.change(screen.getByPlaceholderText("What would make this better?"), {
      target: { value: "A private thought" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localWrite).not.toHaveBeenCalled();
    expect(sessionWrite).not.toHaveBeenCalled();
    expect(mocks.emitClientEvent).toHaveBeenCalledWith("home.ideas_note_composed", {});
    expect(mocks.emitClientEvent.mock.calls.at(-1)?.[1]).toEqual({});
    fetchSpy.mockRestore();
    localWrite.mockRestore();
    sessionWrite.mockRestore();
  });
});