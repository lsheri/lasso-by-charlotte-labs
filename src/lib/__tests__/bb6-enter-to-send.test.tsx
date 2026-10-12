// @vitest-environment jsdom
/**
 * BB-6: Enter sends, Shift+Enter is a new line, in every Ask Lasso composer.
 * Both composers (AskSurface, used by the board panel, the side dock and the phone
 * sheet; and the /reflect page) call the one shared rule, shouldSendAskOnEnter.
 * The rule is driven for real through a textarea wired exactly as both composers
 * wire it; the wiring itself is pinned as source.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { hasTouchInput, shouldSendAskOnEnter } from "@/components/reflect/AskSurface";

const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");
const COMPOSERS = {
  AskSurface: { src: read("components/reflect/AskSurface.tsx"), call: "shouldSendAskOnEnter(\n                event.nativeEvent,\n                hasTouchInput(),\n                ask.draft,\n                ask.pending,\n              )", send: "void ask.submit();" },
  ReflectPage: { src: read("pages/ReflectPage.tsx"), call: "shouldSendAskOnEnter(event.nativeEvent, hasTouchInput(), draft, pending)", send: "void submit();" },
};

function Harness({ onSend, pending = false }: { onSend: (text: string) => void; pending?: boolean }) {
  const [draft, setDraft] = useState("");
  return (
    <textarea
      aria-label="composer"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(event) => {
        if (!shouldSendAskOnEnter(event.nativeEvent, hasTouchInput(), draft, pending)) return;
        event.preventDefault();
        onSend(draft);
        setDraft("");
      }}
    />
  );
}

function setup(pending = false) {
  const onSend = vi.fn();
  render(<Harness onSend={onSend} pending={pending} />);
  const box = screen.getAllByLabelText("composer").at(-1) as HTMLTextAreaElement;
  return { onSend, box };
}

for (const [name, composer] of Object.entries(COMPOSERS)) {
  describe(`BB-6 ${name}`, () => {
    it("uses the one shared Enter rule, then sends", () => {
      const at = composer.src.indexOf(composer.call);
      expect(at).toBeGreaterThan(0);
      expect(composer.src.indexOf(composer.send, at)).toBeGreaterThan(at);
    });

    it("Enter sends once and clears", () => {
      const { onSend, box } = setup();
      fireEvent.change(box, { target: { value: "What changed?" } });
      const allowed = fireEvent.keyDown(box, { key: "Enter", keyCode: 13 });
      expect(allowed).toBe(false);
      expect(onSend).toHaveBeenCalledTimes(1);
      expect(onSend).toHaveBeenCalledWith("What changed?");
      expect(box.value).toBe("");
    });

    it("Shift+Enter keeps the newline and does not send", () => {
      const { onSend, box } = setup();
      fireEvent.change(box, { target: { value: "line one" } });
      expect(fireEvent.keyDown(box, { key: "Enter", keyCode: 13, shiftKey: true })).toBe(true);
      expect(onSend).not.toHaveBeenCalled();
    });

    it("Enter on empty or whitespace does not send", () => {
      const { onSend, box } = setup();
      fireEvent.keyDown(box, { key: "Enter", keyCode: 13 });
      fireEvent.change(box, { target: { value: "   \n " } });
      fireEvent.keyDown(box, { key: "Enter", keyCode: 13 });
      expect(onSend).not.toHaveBeenCalled();
    });

    it("Enter during composition or while sending does not send", () => {
      const { onSend, box } = setup();
      fireEvent.change(box, { target: { value: "日本" } });
      fireEvent.keyDown(box, { key: "Enter", keyCode: 13, isComposing: true });
      fireEvent.keyDown(box, { key: "Enter", keyCode: 229 });
      expect(onSend).not.toHaveBeenCalled();
      const busy = setup(true);
      fireEvent.change(busy.box, { target: { value: "again" } });
      fireEvent.keyDown(busy.box, { key: "Enter", keyCode: 13 });
      expect(busy.onSend).not.toHaveBeenCalled();
    });
  });
}
