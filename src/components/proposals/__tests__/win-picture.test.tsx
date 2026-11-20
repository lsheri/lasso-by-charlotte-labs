// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WIN_PICTURE_COPY, WIN_PICTURE_MAX, WinPicture } from "@/components/proposals/WinPicture";
import { WIN_COPY } from "@/lib/proposal-desk-shared";

afterEach(cleanup);
const cards = (kind: string) => [...document.querySelectorAll(`[data-win-card="${kind}"]`)];

describe("the small board in Record the win", () => {
  it("draws the brief and one card per document, named with the person's own titles", () => {
    render(<WinPicture count={2} titles={["Call notes", "RFP.pdf"]} />);
    expect(cards("brief")).toHaveLength(1);
    expect(cards("document").map((card) => card.textContent)).toEqual(["Call notes", "RFP.pdf"]);
    expect(cards("more")).toHaveLength(0);
    expect(screen.getByText(WIN_PICTURE_COPY.caption(2))).toBeTruthy();
  });

  it("only decorates: the drawing and caption are hidden from a screen reader, which hears the full sentence once", () => {
    render(<WinPicture count={3} titles={["A", "B", "C"]} />);
    expect(document.querySelector("[data-win-board]")?.getAttribute("aria-hidden")).toBe("true");
    expect(document.querySelector("[data-win-caption]")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getAllByText(WIN_COPY.body(3))).toHaveLength(1);
    expect(screen.getByText(WIN_COPY.body(3)).className).toBe("sr-only");
    // The privacy line is not hidden from anyone.
    const lock = document.querySelector("[data-win-private]") as HTMLElement;
    expect(lock.closest("[aria-hidden]")).toBeNull();
    expect(lock.textContent).toBe(`${WIN_PICTURE_COPY.private} ${WIN_PICTURE_COPY.privateLine}`);
    expect(lock.className).not.toMatch(/muted/);
    // It promises what the old sentence promised and no more: no "Private", no "only".
    expect(lock.textContent).toBe("Not shared with the firm until you choose. People you add to the board can open these documents.");
    expect(lock.textContent).not.toMatch(/\bprivate\b|\bonly\b/i);
  });

  it("with no documents draws only the brief and says so", () => {
    render(<WinPicture count={0} />);
    expect(cards("brief")).toHaveLength(1);
    expect(cards("document")).toHaveLength(0);
    expect(screen.getByText("The team board starts with your notes as its brief.")).toBeTruthy();
    expect(screen.getByText(WIN_COPY.body(0))).toBeTruthy();
  });

  it("with one document says document, not documents", () => {
    render(<WinPicture count={1} titles={["Call notes"]} />);
    expect(screen.getByText("The team board starts with your notes as its brief and your document.")).toBeTruthy();
  });

  it("folds many documents into one more card, and the numbers add up", () => {
    const titles = Array.from({ length: 20 }, (_, index) => `Document ${index + 1}`);
    render(<WinPicture count={20} titles={titles} />);
    expect(cards("document")).toHaveLength(WIN_PICTURE_MAX);
    expect(cards("more").map((card) => card.textContent)).toEqual([WIN_PICTURE_COPY.more(20 - WIN_PICTURE_MAX)]);
    expect(screen.getByText(WIN_PICTURE_COPY.caption(20))).toBeTruthy();
  });

  it("draws unnamed cards when titles are missing or short of the count, and never fewer than the titles it has", () => {
    render(<WinPicture count={3} />);
    expect(cards("document").map((card) => card.textContent)).toEqual(Array(3).fill(WIN_PICTURE_COPY.document));
    cleanup();
    render(<WinPicture count={3} titles={["Only one"]} />);
    expect(cards("document").map((card) => card.textContent)).toEqual(["Only one", WIN_PICTURE_COPY.document, WIN_PICTURE_COPY.document]);
    cleanup();
    render(<WinPicture count={1} titles={["A", "B"]} />);
    expect(cards("document")).toHaveLength(2);
    expect(screen.getByText(WIN_PICTURE_COPY.caption(2))).toBeTruthy();
  });

  it("a very long title wraps and is clamped, and markup in a title is shown as text", () => {
    const long = "Marrowfield".repeat(30);
    render(<WinPicture count={2} titles={[long, "<img src=x onerror=alert(1)>"]} />);
    const first = cards("document")[0]?.firstElementChild as HTMLElement;
    expect(first.className).toMatch(/line-clamp-2/);
    expect(first.className).toContain("[overflow-wrap:anywhere]");
    expect(document.querySelector("[data-win-board] img")).toBeNull();
    expect(cards("document")[1]?.textContent).toBe("<img src=x onerror=alert(1)>");
  });

  it("uses no em dash and no capitals-only label", () => {
    render(<WinPicture count={6} titles={["A"]} />);
    const text = document.querySelector("[data-win-picture]")?.textContent ?? "";
    expect(text).not.toMatch(/—/);
    expect(document.querySelector("[data-win-picture] .micro-label, [data-win-picture] .uppercase")).toBeNull();
  });
});
