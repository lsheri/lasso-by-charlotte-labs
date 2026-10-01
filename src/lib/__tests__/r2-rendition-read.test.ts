import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const uploads: string[] = [];
const logHealth = vi.fn(async () => undefined);
let downloadBody: string | null = "# Slide 1\nRevenue grew.";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        download: async () =>
          downloadBody === null
            ? { data: null, error: { message: "nope" } }
            : { data: new Blob([downloadBody]), error: null },
        upload: async (path: string) => {
          uploads.push(path);
          return { error: null };
        },
      }),
    },
    from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
  },
}));
vi.mock("@/lib/health.server", () => ({ logHealth }));

import { getItemText, type TextItem } from "@/lib/item-text.server";
import {
  renditionMatchLine,
  renditionOf,
  renditionPlainText,
  renditionTextHeader,
  type ReferenceRendition,
} from "@/lib/reference-rendition-shared";

const UUID = "6d3262dc-32c2-4910-b951-ccee79d82135";
const SHA = "a".repeat(64);
const REF = `${UUID}/rendition-abc-deck-1.md`;
const rend = (over: Record<string, unknown> = {}) => ({
  source_meta: {
    rendition: { ref: REF, format: "markdown", method: "extracted_by_script", match: "yes", sha256_computed: SHA, chars: 20, ...over },
  },
});
const R = (over: Partial<ReferenceRendition> = {}): ReferenceRendition => ({
  ref: REF, format: "markdown", method: "extracted_by_script", match: "yes", sha: SHA, chars: 1, ...over,
});

describe("renditionOf", () => {
  it("parses a valid rendition", () => {
    expect(renditionOf(rend())).toEqual({ ref: REF, format: "markdown", method: "extracted_by_script", match: "yes", sha: SHA, chars: 20 });
  });
  it("rejects anything that is not an R1 rendition file", () => {
    for (const ref of ["someone/else/file.pdf", "../x.md", `${UUID}/deck.pptx`]) {
      expect(renditionOf(rend({ ref }))).toBeNull();
    }
    expect(renditionOf({ source_meta: {} })).toBeNull();
    expect(renditionOf(null)).toBeNull();
  });
  it("weakens unknown method and drops bad sha", () => {
    const r = renditionOf(rend({ method: "magic", sha256_computed: "xyz", match: "maybe" }))!;
    expect(r.method).toBe("written_by_model");
    expect(r.sha).toBeNull();
    expect(r.match).toBe("unknown");
  });
});

describe("labels", () => {
  it("headers for both methods", () => {
    expect(renditionTextHeader(R(), "deck.pptx")).toBe("[Rendition of deck.pptx, made by a script in the chat. Not the original file.]");
    expect(renditionTextHeader(R({ match: "no" }), "deck.pptx")).toContain("\n[This rendition was changed after the script made it.]");
    expect(renditionTextHeader(R({ method: "written_by_model" }), "deck.pptx")).toBe("[AI-written summary of deck.pptx. Not the original file and not copied from it.]");
  });
  it("match line never for written_by_model", () => {
    expect(renditionMatchLine(R({ method: "written_by_model", match: "yes" }))).toBeNull();
    expect(renditionMatchLine(R({ match: "unknown" }))).toBeNull();
    expect(renditionMatchLine(R({ match: "no" }))).toBe("Changed after the script made it.");
  });
  it("plain text", () => {
    const out = renditionPlainText(R({ format: "html" }), "<script>alert(1)</script><p>A &amp; B</p><div>C</div>");
    expect(out).not.toContain("alert");
    expect(out).not.toContain("<");
    expect(out).toContain("A & B");
    expect(renditionPlainText(R(), "# Hi <b>x</b>")).toBe("# Hi <b>x</b>");
  });
});

describe("getItemText on a placeholder", () => {
  beforeEach(() => {
    uploads.length = 0;
    logHealth.mockClear();
    downloadBody = "# Slide 1\nRevenue grew.";
  });
  const base = (sm: Record<string, unknown>): TextItem =>
    ({ id: "w1", title: "deck", type: "deliverable", content_ref: null, source_meta: sm, meta: {} }) as unknown as TextItem;

  it("reads the rendition, labelled", async () => {
    const res = await getItemText({} as never, base({ filename: "deck.pptx", ...rend().source_meta }));
    expect(res.status).toBe("ok");
    expect(res.text?.startsWith("[Rendition of deck.pptx, made by a script in the chat.")).toBe(true);
    expect(logHealth).not.toHaveBeenCalled();
    expect(uploads[0]?.startsWith(`${UUID}/derived/`)).toBe(true);
  });
  it("no rendition stays no_stored_bytes", async () => {
    const res = await getItemText({} as never, base({ filename: "deck.pptx" }));
    expect(res.status).toBe("unreadable");
    expect(res.reason).toBe("no_stored_bytes");
  });
});

describe("source pins", () => {
  it("surfaces", () => {
    const rc = readFileSync("src/components/peek/RenderedContent.tsx", "utf8");
    expect(rc).toContain("This file was made in a chat and has not been added yet. Add it from the card on the board.");
    expect(rc).toContain("RenditionPane");
    expect(readFileSync("src/components/canvas-lab/ReferenceFileCard.tsx", "utf8")).toContain("renditionTitle(");
  });
});
