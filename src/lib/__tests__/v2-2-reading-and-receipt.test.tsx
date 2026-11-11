// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { AskReadingV2 } from "@/components/reflect/AskReadingV2";
import { ContextAudit } from "@/components/reflect/ContextTrail";
import type { ContextManifest, ManifestItem } from "@/lib/context-manifest";
import {
  askPhase,
  chipLabel,
  itemWasRead,
  kindChips,
  readTally,
  receiptLine,
  sameSetLine,
  videoLine,
  whatsNew,
} from "@/lib/ask-reading-v2";

beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }),
    });
  }
});
afterEach(() => cleanup());

const t = (id: string, read = true): ManifestItem => ({
  id,
  title: `Call ${id}`,
  kind: "transcript",
  detail: read ? "1,200 words" : "stored text not read, over the window",
  chars_in: read ? 1200 : 0,
  chars_total: 1200,
});
const conv = (id: string): ManifestItem => ({
  id,
  title: `Chat ${id}`,
  kind: "conversation",
  detail: "turns 1-12",
  chars_in: 900,
  chars_total: 900,
});
const summary = (id: string): ManifestItem => ({
  id,
  title: `Deck ${id}`,
  kind: "deck",
  detail: "summary only, full text not opened",
  chars_in: 0,
  chars_total: 4000,
});
const image = (id: string): ManifestItem => ({
  id: `image:${id}`,
  title: "Revenue table",
  kind: "item",
  detail: "AI description of an image",
  chars_in: 300,
  chars_total: 300,
});
const m = (items: ManifestItem[], excluded: ContextManifest["excluded"] = []): ContextManifest => ({
  engagement: null,
  brief_included: false,
  firm_checks_applied: 0,
  items,
  excluded,
  assembled_at: "2026-11-08T23:00:00Z",
});

describe("V2-2 rule 4: never 'read' for unread", () => {
  it("a summary, an item over the window and an item with no stored text are not reads", () => {
    expect(itemWasRead(summary("d1"))).toBe(false);
    expect(itemWasRead(t("x", false))).toBe(false);
    expect(
      itemWasRead({
        id: "n",
        title: "n",
        kind: "note",
        detail: "no stored text",
        chars_in: 0,
        chars_total: 0,
      }),
    ).toBe(false);
    expect(itemWasRead(t("a"))).toBe(true);
  });
  it("older manifests without character counts read from the detail", () => {
    expect(itemWasRead({ id: "a", title: "a", kind: "document", detail: "read in full" })).toBe(
      true,
    );
    expect(
      itemWasRead({
        id: "b",
        title: "b",
        kind: "document",
        detail: "summary only, full text not opened",
      }),
    ).toBe(false);
  });
  it("the receipt counts only real reads and names the gap", () => {
    const man = m([t("1"), t("2"), t("3"), summary("4")]);
    expect(readTally(man)).toEqual({ read: 3, total: 4 });
    expect(receiptLine(man)).toBe("Read 3 of 4");
  });
  it("catalogue rows that stand for many count as many", () => {
    const man = m(
      [t("1")],
      [
        { title: "Deal points", reason: "listed in the record, not opened for this question" },
        {
          title: "12 more pieces of work",
          reason: "listed in the record, not opened for this question",
        },
      ],
    );
    expect(readTally(man)).toEqual({ read: 1, total: 14 });
  });
  it("a chip with an unread piece says how many of how many", () => {
    const [chip] = kindChips(m([t("1"), t("2", false)]));
    expect(chipLabel(chip!)).toBe("1 of 2 transcripts");
  });
});

describe("V2-2 D1 receipt", () => {
  it("names what the answer used, by kind", () => {
    const man = m([t("1"), t("2"), t("3"), t("4"), conv("5")]);
    expect(receiptLine(man, ["1", "2", "3", "4"])).toBe("Read 5 of 5 · used 4 transcripts");
  });
  it("mixed kinds say pieces of work; a citation to an unread piece is never 'used'", () => {
    const man = m([t("1"), conv("2"), summary("3")]);
    expect(receiptLine(man, ["1", "2", "3", null])).toBe("Read 2 of 3 · used 2 pieces of work");
  });
  it("nothing to read says so plainly", () => {
    expect(receiptLine(m([]))).toBe("Nothing was read");
    expect(receiptLine({ ...m([]), brief_included: true })).toBe("Read the brief");
  });
  it("never mentions cost", () => {
    const src = readFileSync("src/lib/ask-reading-v2.ts", "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
      .join("\n");
    expect(src).not.toMatch(/\bcost|\btokens?\b|\bprice|\bspend|\$\d/i);
  });
});

describe("V2-2 images and videos", () => {
  it("an image counts as read and gets its own chip", () => {
    const man = m([t("1"), image("i1")]);
    expect(readTally(man)).toEqual({ read: 2, total: 2 });
    expect(kindChips(man).map((c) => c.kind)).toEqual(["transcript", "image"]);
  });
  it("videos are never counted, only named 'not read'", () => {
    expect(videoLine(0)).toBeNull();
    expect(videoLine(1)).toBe("1 video, not read");
    expect(videoLine(2)).toBe("2 videos, not read");
    render(<AskReadingV2 manifest={m([t("1")])} streamed="" pickedCount={2} pickedVideos={1} />);
    expect(screen.getByTestId("ask-v2-video").textContent).toBe("1 video, not read");
    expect(screen.getAllByTestId("ask-v2-chip").map((c) => c.textContent)).toEqual([
      "1 transcript",
    ]);
  });
});

describe("V2-2 header status", () => {
  it("Gathering until the read frame, Reading until the first word, then Writing", () => {
    expect(askPhase({ manifest: null, streamed: "" })).toBe("gathering");
    expect(askPhase({ manifest: m([t("1")]), streamed: "" })).toBe("reading");
    expect(askPhase({ manifest: m([t("1")]), streamed: "The" })).toBe("writing");
  });
  it("the progress line is a three-step stage and the answer shape goes once words arrive", () => {
    const { rerender } = render(<AskReadingV2 manifest={null} streamed="" pickedCount={0} />);
    expect(screen.getByTestId("ask-v2-status").textContent).toBe("Gathering");
    expect(screen.getByTestId("ask-v2-steps").getAttribute("data-step")).toBe("1");
    expect(screen.getByTestId("ask-v2-chip").textContent).toBe("The whole board");
    rerender(<AskReadingV2 manifest={m([t("1"), t("2")])} streamed="" pickedCount={0} />);
    expect(screen.getByTestId("ask-v2-status").textContent).toBe("Reading");
    expect(screen.getByTestId("ask-v2-chip").getAttribute("data-read")).toBe("all");
    expect(screen.getByTestId("ask-v2-shape")).toBeTruthy();
    rerender(<AskReadingV2 manifest={m([t("1"), t("2")])} streamed="The answer" pickedCount={0} />);
    expect(screen.getByTestId("ask-v2-status").textContent).toBe("Writing");
    expect(screen.queryByTestId("ask-v2-shape")).toBeNull();
  });
  it("a pick says how many before the server answers", () => {
    render(<AskReadingV2 manifest={null} streamed="" pickedCount={3} />);
    expect(screen.getByTestId("ask-v2-chip").textContent).toBe("3 pieces picked");
  });
});

describe("V2-2 only show what's new", () => {
  it("first turn shows the full sequence", () => {
    expect(whatsNew(m([t("1")]), null)).toEqual({ kind: "first" });
  });
  it("the same set says so instead of replaying the chips", () => {
    const man = m([t("1"), t("2")]);
    expect(whatsNew(man, m([t("2"), t("1")]))).toEqual({ kind: "same", count: 2 });
    render(
      <AskReadingV2
        manifest={man}
        previousManifest={m([t("1"), t("2")])}
        streamed=""
        pickedCount={0}
      />,
    );
    expect(screen.getByTestId("ask-v2-same").textContent).toBe("Same 2 pieces, already read");
    expect(screen.queryAllByTestId("ask-v2-chip")).toHaveLength(0);
  });
  it("never says 'already read' when a piece of the same set was not read", () => {
    expect(sameSetLine(m([t("1"), t("2", false)]))).toBeNull();
  });
  it("a new piece gets a dot on its kind and a count", () => {
    render(
      <AskReadingV2
        manifest={m([t("1"), conv("2")])}
        previousManifest={m([t("1")])}
        streamed=""
        pickedCount={0}
      />,
    );
    expect(screen.getByTestId("ask-v2-fresh").textContent).toBe("1 new");
    const chips = screen.getAllByTestId("ask-v2-chip");
    expect(
      chips
        .find((c) => c.getAttribute("data-kind") === "conversation")
        ?.querySelector("[data-testid='ask-v2-new-dot']"),
    ).toBeTruthy();
    expect(
      chips
        .find((c) => c.getAttribute("data-kind") === "transcript")
        ?.querySelector("[data-testid='ask-v2-new-dot']"),
    ).toBeNull();
  });
  it("is worked out on the client: no fetch, no server function", () => {
    const src =
      readFileSync("src/components/reflect/AskReadingV2.tsx", "utf8") +
      readFileSync("src/lib/ask-reading-v2.ts", "utf8");
    expect(src).not.toMatch(/fetch\(|createServerFn|supabase|emitClientEvent/);
  });
});

describe("V2-2 is the only reading state (ASK-V2-CLEANUP)", () => {
  it("MessagesTab draws the V2 pieces with no flag and no old trail", () => {
    const src = readFileSync("src/components/reflect/AskSurface.tsx", "utf8");
    expect(src).not.toMatch(/askV2|ASK_V2/);
    expect(src).toMatch(/<div className="nb-binder-inset">\s*<AskReadingV2/);
    expect(src).toMatch(/v2=\{manifest \?/);
    expect(src).not.toContain("ThinkingTrail");
  });
  it("ContextAudit without v2 keeps its label and count", () => {
    const man = m([t("1"), t("2")]);
    const { container } = render(<ContextAudit manifest={man} />);
    expect(container.textContent).toContain("Read what went into this response");
    expect(container.textContent).toContain("2");
    expect(screen.queryByTestId("ask-receipt")).toBeNull();
  });
  it("ContextAudit with v2 shows only the receipt", () => {
    const man = m([t("1"), t("2")]);
    const { container } = render(
      <ContextAudit manifest={man} v2={{ receipt: receiptLine(man) }} />,
    );
    expect(screen.getByTestId("ask-receipt").textContent).toBe("Read 2 of 2");
    expect(container.textContent).not.toContain("Read what went into this response");
  });
});
