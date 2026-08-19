import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";

import { openDocumentText } from "@/lib/item-text.server";
import { contentsUnread, readCounts, textStatusOf } from "@/lib/text-status";

const ODT_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content><office:body><office:text>
<text:h>Engagement plan</text:h>
<text:p>We agreed to <text:span>ship</text:span> phase one by June.</text:p>
<text:p>Cost is &lt;20k&gt; &amp; fixed.</text:p>
<text:p/>
</office:text></office:body></office:document-content>`;

describe("openDocumentText", () => {
  it("reads headings and paragraphs as lines", () => {
    const text = openDocumentText(ODT_CONTENT);
    expect(text).toContain("Engagement plan");
    expect(text).toContain("We agreed to ship phase one by June.");
  });

  it("unescapes entities", () => {
    expect(openDocumentText(ODT_CONTENT)).toContain("Cost is <20k> & fixed.");
  });

  it("keeps table cells and rows apart", () => {
    const xml =
      "<table:table-row><table:table-cell><text:p>A</text:p></table:table-cell>" +
      "<table:table-cell><text:p>B</text:p></table:table-cell></table:table-row>";
    const text = openDocumentText(xml);
    expect(text).toContain("A");
    expect(text).toContain("B");
  });

  it("returns nothing for a body with no text", () => {
    expect(openDocumentText("<office:body><office:text></office:text></office:body>")).toBe("");
  });

  it("survives a real zip round trip", () => {
    const zipped = zipSync({ "content.xml": strToU8(ODT_CONTENT) });
    expect(zipped.byteLength).toBeGreaterThan(0);
  });
});

describe("text status", () => {
  it("treats absence as not attempted", () => {
    expect(textStatusOf(null)).toBe("not_attempted");
    expect(textStatusOf({})).toBe("not_attempted");
  });

  it("maps the legacy empty status onto unreadable", () => {
    expect(textStatusOf({ text_status: "empty" })).toBe("unreadable");
  });

  it("only calls contents unread when a read actually failed", () => {
    expect(contentsUnread({ text_status: "ok" })).toBe(false);
    expect(contentsUnread({})).toBe(false);
    for (const status of ["unsupported", "unreadable", "failed", "empty"]) {
      expect(contentsUnread({ text_status: status })).toBe(true);
    }
  });
});

describe("readCounts", () => {
  it("never promises to read what could not be read", () => {
    expect(readCounts(6, 2)).toEqual({ readable: 4, titleOnly: 2 });
    expect(readCounts(3, 3)).toEqual({ readable: 0, titleOnly: 3 });
  });

  it("stays sane on bad inputs", () => {
    expect(readCounts(2, 5)).toEqual({ readable: 0, titleOnly: 2 });
    expect(readCounts(0, 0)).toEqual({ readable: 0, titleOnly: 0 });
  });
});
