import { describe, expect, it } from "vitest";
import { readingLinePath, type Box } from "@/lib/ask-reading-lines";

const stage: Box = { left: 0, top: 0, right: 1000, bottom: 800 };
const ask: Box = { left: 600, top: 300, right: 900, bottom: 700 };
const end = (d: string) => d.trim().split(/[ ,]+/).slice(-2).map(Number);
const start = (d: string) => d.split(" ").slice(1, 3).map(Number);

describe("readingLinePath", () => {
  it("a card left of Ask ends on Ask's left edge", () => {
    const d = readingLinePath({ left: 100, top: 450, right: 200, bottom: 550 }, ask, stage)!;
    expect(end(d)[0]).toBe(600);
  });
  it("a card above Ask ends on Ask's top edge", () => {
    const d = readingLinePath({ left: 700, top: 0, right: 800, bottom: 60 }, ask, stage)!;
    expect(end(d)[1]).toBe(300);
  });
  it("a card right of Ask starts from the card's left edge", () => {
    const narrow: Box = { left: 300, top: 300, right: 500, bottom: 700 };
    const d = readingLinePath({ left: 800, top: 450, right: 900, bottom: 550 }, narrow, stage)!;
    expect(start(d)[0]).toBe(800);
    expect(end(d)[0]).toBe(500);
  });
  it("a card entirely outside the stage gives null", () => {
    expect(readingLinePath({ left: -300, top: 100, right: -200, bottom: 200 }, ask, stage)).toBeNull();
  });
  it("a card whose centre is under Ask gives null", () => {
    expect(readingLinePath({ left: 700, top: 400, right: 800, bottom: 500 }, ask, stage)).toBeNull();
  });
  it("Ask shorter than 48px uses its vertical centre", () => {
    const short: Box = { left: 600, top: 700, right: 900, bottom: 740 };
    const d = readingLinePath({ left: 100, top: 600, right: 200, bottom: 650 }, short, stage)!;
    expect(end(d)).toEqual([600, 720]);
  });
});
