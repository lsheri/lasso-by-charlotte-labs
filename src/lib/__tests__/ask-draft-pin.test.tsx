// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const logEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry", () => ({ logEvent }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }) } }));

import { LabAnswerCard } from "@/components/canvas-lab/LabAnswerCard";
import { AskSurface } from "@/components/reflect/AskSurface";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

const node = { id: "n1", kind: "answer", title: "Answer", summary: "The answer text", x: 0, y: 0, width: 280, height: 160, ownership: "yours" } as unknown as LabNode;
const cardProps = { node, focused: false, stackZ: 1, onFocus: vi.fn(), onPointerDown: vi.fn(), onDelete: vi.fn(), orgId: "org" };

afterEach(() => { cleanup(); logEvent.mockReset(); window.localStorage.clear(); window.history.replaceState(null, "", "/"); });

describe("ASK-D2 pinned card", () => {
  it("with no map entry shows no Chat row", async () => {
    window.history.replaceState(null, "", "/?ask=a");
    render(<LabAnswerCard {...cardProps} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("button", { name: /^Chat/ })).toBeNull();
  });
  it("with a map entry shows Chat, and a press fires the event once", async () => {
    window.history.replaceState(null, "", "/?ask=a");
    window.localStorage.setItem("lasso.ask-draft.pins", JSON.stringify({ n1: "s1" }));
    render(<LabAnswerCard {...cardProps} />);
    const row = await screen.findByRole("button", { name: /^Chat/ });
    fireEvent.click(row);
    const calls = logEvent.mock.calls.filter(([name]) => name === "workboard.pinned_chat_opened");
    expect(calls).toEqual([["workboard.pinned_chat_opened", "org", { draft: "a" }]]);
    await waitFor(() => expect(screen.getByText("This chat is not available to you here.")).toBeTruthy());
  });
  it("with the gate closed a map entry still shows no Chat row", async () => {
    window.localStorage.setItem("lasso.ask-draft.pins", JSON.stringify({ n1: "s1" }));
    render(<LabAnswerCard {...cardProps} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("button", { name: /^Chat/ })).toBeNull();
  });
});
