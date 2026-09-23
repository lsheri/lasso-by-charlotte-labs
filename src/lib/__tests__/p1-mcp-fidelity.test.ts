import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  parseMessageFidelity,
  pushProgress,
  turnFidelity,
  versionRowsBucket,
} from "@/lib/mcp-handler.server";
import { summarisedLabel, summarisedSpan } from "@/components/peek/ThreadBody";

const handler = readFileSync("src/lib/mcp-handler.server.ts", "utf8");

describe("P1 item 1 — a summary says which positions it stands for", () => {
  it("treats a message with no flag as verbatim", () => {
    expect(parseMessageFidelity({}, 1)).toEqual({ fidelity: "verbatim" });
    expect(parseMessageFidelity({ fidelity: "verbatim" }, 1)).toEqual({ fidelity: "verbatim" });
  });

  it("accepts a summary that names its span", () => {
    expect(parseMessageFidelity({ fidelity: "summary", covers: { from: 4, to: 9 } }, 3)).toEqual({
      fidelity: "summary",
      covers_from: 4,
      covers_to: 9,
    });
  });

  it("refuses a summary without covers, or with an impossible span", () => {
    expect(parseMessageFidelity({ fidelity: "summary" }, 2)).toEqual({
      error: "Message 2: a summary needs covers {from, to}, the positions it stands for.",
    });
    const backwards = parseMessageFidelity({ fidelity: "summary", covers: { from: 9, to: 4 } }, 2);
    expect("error" in backwards).toBe(true);
    const unknown = parseMessageFidelity({ fidelity: "paraphrase" }, 5);
    expect(unknown).toEqual({
      error: "Message 5: fidelity must be 'verbatim' or 'summary'.",
    });
  });

  it("reads a stored turn's fidelity, absence meaning verbatim", () => {
    expect(turnFidelity(null)).toBe("verbatim");
    expect(turnFidelity({ revised_at: "x" })).toBe("verbatim");
    expect(turnFidelity({ fidelity: "summary", covers_from: 1, covers_to: 3 })).toBe("summary");
  });

  it("keeps a verbatim turn when a summary arrives at its position", () => {
    expect(handler).toContain("if (isSummary && priorFidelity === \"verbatim\") {");
    expect(handler).toContain("summaryRefused.push(turnNo);");
    expect(handler).toContain("is verbatim in Lasso; a summary never replaces it");
  });

  it("lets a verbatim message replace a stored summary and clears the flag", () => {
    expect(handler).toContain(
      'const replacingSummary = !isSummary && priorFidelity === "summary";',
    );
    expect(handler).toContain('delete priorMeta["fidelity"];');
    expect(handler).toContain('delete priorMeta["covers_from"];');
    expect(handler).toContain("if (!replacingSummary && looksCondensed(");
  });

  it("counts summary spans into the content-free band", () => {
    expect(handler).toContain("summary_spans: versionRowsBucket(summarySpans),");
    expect(versionRowsBucket(0)).toBe("0");
    expect(versionRowsBucket(1)).toBe("1");
    expect(versionRowsBucket(3)).toBe("2+");
  });
});

describe("P1 item 0 — the structured response carries everything", () => {
  it("says where the caller stands", () => {
    expect(pushProgress(5, 12)).toEqual({ next_from: 6, complete: false });
    expect(pushProgress(12, 12)).toEqual({ next_from: null, complete: true });
    expect(pushProgress(3, null)).toEqual({ next_from: null, complete: false });
  });

  it("returns the summary, counts, placement and notes as fields", () => {
    expect(handler).toContain("content: [{ type: \"text\", text: summary }],");
    expect(handler).toContain("stored_count: storedCount,");
    expect(handler).toContain("next_from: progress.next_from,");
    expect(handler).toContain("complete: progress.complete,");
    expect(handler).toContain("attachments_total: placeTargets.length,");
    expect(handler).toContain("notes,");
    expect(handler).toContain("summary: optionsText,");
  });
});

describe("P1 item 2 — a summarised span in the viewer", () => {
  it("reads the span from the turn's own record", () => {
    expect(summarisedSpan({ meta: { fidelity: "summary", covers_from: 2, covers_to: 7 } })).toEqual({
      from: 2,
      to: 7,
    });
    expect(summarisedSpan({ meta: { revised_at: "x" } })).toBeNull();
    expect(summarisedSpan({})).toBeNull();
  });

  it("uses the approved wording", () => {
    expect(summarisedLabel({ from: 2, to: 7 })).toBe(
      "Summarised by the AI client. Messages 2 to 7 were not available word for word.",
    );
  });
});

describe("P1 items 3 and 4", () => {
  it("tells the caller how to send a span it can no longer reproduce", () => {
    expect(handler).toContain(
      "send that span as ONE message with fidelity: summary and covers: {from, to}",
    );
  });

  it("prints the unique ref in the places listing", () => {
    expect(handler).toContain("const refByBoardWorkstream = new Map(");
    expect(handler).toContain("refByBoardWorkstream.get(");
  });
});
