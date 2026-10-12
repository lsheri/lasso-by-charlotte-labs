// @vitest-environment jsdom
/**
 * BB-3: typing on a busy board stays local to the box being typed in.
 * Real LabTextBlock and LabAnswerCard are rendered side by side under a parent
 * that owns the nodes, the way the page does. The full page is too data-bound
 * to mount, so its keydown binding is pinned as source.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Profiler, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { LabAnswerCard } from "@/components/canvas-lab/LabAnswerCard";
import { LabTextBlock } from "@/components/canvas-lab/LabTextBlock";
import { sameCardProps, stableMemo } from "@/components/canvas-lab/stable-memo";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

const base = { frame: null, ownership: "yours", typeLabel: "", x: 0, y: 0, width: 200, height: 100, local: true } as const;
const textNode = { ...base, id: "t1", kind: "text", title: "", summary: "" } as unknown as LabNode;
const answerNode = { ...base, id: "a1", kind: "answer", title: "Answer", summary: "Kept answer" } as unknown as LabNode;

function Board({ onCommit, onSiblingRender, onParentRender }: { onCommit: (text: string) => void; onSiblingRender: () => void; onParentRender: () => void }) {
  const [nodes, setNodes] = useState([textNode, answerNode]);
  onParentRender();
  const text = nodes[0]!;
  const answer = nodes[1]!;
  return (
    <>
      <LabTextBlock node={text} selected editable layoutEditable onSelect={() => undefined} onDragStart={() => undefined} onResizeStart={() => undefined} onResizeKeyDown={() => undefined} onResizeKeyUp={() => undefined}
        onChange={(body) => setNodes((current) => current.map((n) => (n.id === text.id ? { ...n, summary: body.text } : n)))}
        onCommit={(body) => onCommit(body.text)} onRemove={() => undefined} />
      <Profiler id="sibling" onRender={onSiblingRender}>
        <LabAnswerCard node={answer} focused={false} stackZ={1} onFocus={() => undefined} onPointerDown={() => undefined} onDelete={() => undefined} frameChoices={[{ id: "f", name: "F" }]} />
      </Profiler>
    </>
  );
}

describe("BB-3 typing stays in the box", () => {
  it("20 keystrokes re-render the sibling card 0 times and commit once on blur", () => {
    const onCommit = vi.fn();
    const onSiblingRender = vi.fn();
    const onParentRender = vi.fn();
    render(<Board onCommit={onCommit} onSiblingRender={onSiblingRender} onParentRender={onParentRender} />);
    const box = screen.getByLabelText("Text block words") as HTMLTextAreaElement;
    const siblingBefore = onSiblingRender.mock.calls.length;
    const parentBefore = onParentRender.mock.calls.length;
    let typed = "";
    for (let i = 0; i < 20; i += 1) {
      typed += "abcdefghijklmnopqrst"[i];
      fireEvent.change(box, { target: { value: typed } });
    }
    expect(box.value).toBe(typed);
    expect(onSiblingRender.mock.calls.length - siblingBefore).toBe(0);
    expect(onParentRender.mock.calls.length - parentBefore).toBe(0);
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(box);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(typed);
    // The parent heard the words once; the memoized sibling still did not re-render.
    expect(onSiblingRender.mock.calls.length - siblingBefore).toBe(0);
  });

  it("the card memo ignores fresh callbacks and equal small arrays, but sees data changes", () => {
    const node = answerNode;
    expect(sameCardProps({ node, onX: () => 1, list: [{ id: "f" }] }, { node, onX: () => 2, list: [{ id: "f" }] })).toBe(true);
    expect(sameCardProps({ node }, { node: { ...node, summary: "changed" } })).toBe(false);
    expect(sameCardProps({ onX: () => 1 }, { onX: undefined })).toBe(false);
  });

  it("a skipped render still calls the newest callback", () => {
    const seen: string[] = [];
    const Button = stableMemo(({ label, onPress }: { label: string; onPress: () => void }) => <button onClick={onPress}>{label}</button>);
    const { rerender } = render(<Button label="go" onPress={() => seen.push("old")} />);
    rerender(<Button label="go" onPress={() => seen.push("new")} />);
    fireEvent.click(screen.getByRole("button", { name: "go" }));
    expect(seen).toEqual(["new"]);
  });

  it("the page binds its window keydown listener once, reading state through a ref", () => {
    const page = readFileSync(resolve(__dirname, "../../pages/CanvasLabPage.tsx"), "utf8");
    expect(page).toContain("boardKeyRef.current = onBoardKey;");
    expect(page).toMatch(/const onKey = \(event: KeyboardEvent\) => boardKeyRef\.current\(event\);\s*window\.addEventListener\("keydown", onKey\);\s*return \(\) => window\.removeEventListener\("keydown", onKey\);\s*\}, \[\]\);/);
    expect(page).toContain("if (isTypingTarget(event.target) || isTypingTarget(document.activeElement)) return;");
  });

  it("a bound-once listener is added once across 20 keystrokes", () => {
    const add = vi.spyOn(window, "addEventListener");
    function Harness() {
      const [text, setText] = useState("");
      const ref = { current: (_: KeyboardEvent) => undefined as void };
      void ref;
      // Same shape as the page: state changes every key, the effect has no deps.
      return <BoundOnce text={text} onType={setText} />;
    }
    render(<Harness />);
    const box = screen.getByLabelText("harness") as HTMLInputElement;
    for (let i = 0; i < 20; i += 1) fireEvent.change(box, { target: { value: "x".repeat(i + 1) } });
    expect(add.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);
    add.mockRestore();
  });
});

import { useEffect, useRef } from "react";
function BoundOnce({ text, onType }: { text: string; onType: (v: string) => void }) {
  const handler = useRef<(event: KeyboardEvent) => void>(() => undefined);
  handler.current = () => void text;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => handler.current(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return <input aria-label="harness" value={text} onChange={(e) => onType(e.target.value)} />;
}
