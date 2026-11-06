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
    // ASK-B1: preview hosts default to draft b, so the gate is closed with ask=off.
    window.history.replaceState(null, "", "/?ask=off");
    window.localStorage.setItem("lasso.ask-draft.pins", JSON.stringify({ n1: "s1" }));
    render(<LabAnswerCard {...cardProps} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("button", { name: /^Chat/ })).toBeNull();
  });
  it("ASK-B2: reads the pin under the durable id, where keep writes it", async () => {
    window.history.replaceState(null, "", "/?ask=b");
    window.localStorage.setItem("lasso.ask-draft.pins", JSON.stringify({ "durable-1": "s1" }));
    render(<LabAnswerCard {...cardProps} node={{ ...node, id: "answer:local", durableId: "durable-1" } as LabNode} />);
    expect(await screen.findByRole("button", { name: /^Chat/ })).toBeTruthy();
  });
});

import { citedCardAnchors } from "@/lib/answer-card";

describe("ASK-B1 cited card lines", () => {
  const card = (id: string, wi: string, x = 0) => ({ id, workItemId: wi, x, y: 0, width: 200, height: 120 });
  it("skips cites with no card and duplicates, caps at six, and an answer to the right links right to left", () => {
    const cards = Array.from({ length: 8 }, (_, i) => card(`c${i}`, `w${i}`));
    const cites = [{ work_item_id: "missing" }, { work_item_id: "w0" }, { work_item_id: "w0" }, ...cards.slice(1).map((c) => ({ work_item_id: c.workItemId }))];
    const out = citedCardAnchors(cites, cards, { x: 1000, y: 0 });
    expect(out.map((o) => o.cardId)).toEqual(["c0", "c1", "c2", "c3", "c4", "c5"]);
    expect(out[0]).toEqual({ cardId: "c0", fromAnchor: "right", toAnchor: "left" });
  });
});

import { readAskPins, writeAskPin, removeAskPin, readUnpinned, writeUnpinned, clearUnpinned } from "@/lib/ask-draft";

describe("PIN-1 pins store", () => {
  it("removeAskPin deletes a key", () => {
    writeAskPin("d1", "s1", window.localStorage);
    writeAskPin("d2", "s2", window.localStorage);
    removeAskPin("d1", window.localStorage);
    expect(readAskPins(window.localStorage)).toEqual({ d2: "s2" });
  });
  it("writeUnpinned then readUnpinned round trips, and clearUnpinned removes", () => {
    writeUnpinned("s1", "board-1", window.localStorage);
    expect(readUnpinned(window.localStorage)).toEqual({ s1: "board-1" });
    clearUnpinned("s1", window.localStorage);
    expect(readUnpinned(window.localStorage)).toEqual({});
  });
});
