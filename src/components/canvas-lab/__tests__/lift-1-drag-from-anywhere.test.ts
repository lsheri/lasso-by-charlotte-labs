// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import { referenceBodyPressDrags } from "@/components/canvas-lab/reference-press";
import { cardPressStartsDrag } from "@/components/canvas-lab/canvas-lab-model";

afterEach(() => { document.body.innerHTML = ""; });

function piece(): { card: HTMLElement; body: HTMLElement } {
  const card = document.createElement("div");
  const body = document.createElement("div");
  body.innerHTML = '<span class="name">deck.pptx</span><button type="button">Add the file</button><input type="file" /><a href="#">link</a>';
  card.appendChild(body);
  document.body.appendChild(card);
  return { card, body };
}

describe("LIFT-1 L1: a file piece's body drags like any card", () => {
  it("a press on the body's text passes through to the board drag", () => {
    const { card, body } = piece();
    expect(referenceBodyPressDrags(card, body.querySelector(".name"))).toBe(true);
    expect(referenceBodyPressDrags(card, body)).toBe(true);
  });
  it("controls keep their press", () => {
    const { card, body } = piece();
    expect(referenceBodyPressDrags(card, body.querySelector("button"))).toBe(false);
    expect(referenceBodyPressDrags(card, body.querySelector("input"))).toBe(false);
    expect(referenceBodyPressDrags(card, body.querySelector("a"))).toBe(false);
  });
  it("a press from the Drive picker (a portal outside the card's box) never drags the card", () => {
    const { card } = piece();
    const portal = document.createElement("div");
    portal.setAttribute("role", "dialog");
    const row = document.createElement("span");
    portal.appendChild(row);
    document.body.appendChild(portal);
    expect(referenceBodyPressDrags(card, row)).toBe(false);
  });
  it("no element, no drag", () => {
    const { card } = piece();
    expect(referenceBodyPressDrags(card, null)).toBe(false);
  });
  it("the board's own guard still lets a body press start the drag", () => {
    const { body } = piece();
    expect(cardPressStartsDrag({ button: 0, target: body.querySelector(".name") })).toBe(true);
    expect(cardPressStartsDrag({ button: 0, target: body.querySelector("button") })).toBe(false);
  });
});

describe("LIFT-1 L1: a live card's face never starts a text selection", () => {
  const css = readFileSync("src/styles.css", "utf8");
  it("live cards are unselectable before any drag begins; read-only surfaces are left alone", () => {
    expect(css).toContain('[data-testid="canvas-lab-shell"] .canvas-lab-stage [role="group"][data-node-id][data-read-only="false"] { user-select: none; -webkit-user-select: none; }');
  });
  it("edit fields inside a card keep their selection", () => {
    expect(css).toContain('[data-testid="canvas-lab-shell"] .canvas-lab-stage [role="group"][data-node-id][data-read-only="false"] :is(input, textarea, [contenteditable="true"]) { user-select: text; -webkit-user-select: text; }');
  });
  it("LabCard still renders the attributes the rule keys on", () => {
    const card = readFileSync("src/components/canvas-lab/LabCard.tsx", "utf8");
    expect(card).toContain('role="group"');
    expect(card).toContain("data-node-id={node.id}");
    expect(card).toContain("data-read-only={readOnly}");
  });
});
