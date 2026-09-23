import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { guardEventDims } from "@/lib/event-dim-allowlist";
import { DEFAULT_VOCAB, EDU_VOCAB } from "@/lib/edu-vocab";
import { artifactPreviewKind } from "@/lib/workboard-file-preview";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("C1 cleanup", () => {
  it("selects the rendered artifact path for HTML, SVG and Mermaid", () => {
    expect(artifactPreviewKind({ source_meta: { kind: "artifact_html" } })).toBe("html");
    expect(artifactPreviewKind({ source_meta: { kind: "artifact_svg" } })).toBe("svg");
    expect(artifactPreviewKind({ source_meta: { kind: "artifact_mermaid" } })).toBe("mermaid");
    const source = read("src/components/peek/RenderedContent.tsx");
    expect(source).toContain("if (artifactKind)");
    expect(source).toContain("query.isError ? source");
    expect(source).toContain("<TextPane item={item} canEdit={canEdit} onDownload={onDownload} />");
  });

  it("keeps enlarged artifact output inside the isolated iframe", () => {
    const source = read("src/components/peek/RenderedContent.tsx");
    expect(source).toContain('sandbox="allow-scripts"');
    expect(source).not.toMatch(/sandbox="[^"]*allow-same-origin/);
    expect(source).toContain('referrerPolicy="no-referrer"');
    expect(source).toContain("srcDoc={withPreviewCsp(query.data)}");
  });

  it("loads Mermaid dynamically with strict security", () => {
    const source = read("src/lib/mermaid-preview.ts");
    expect(source).toContain('await import("mermaid")');
    expect(source).not.toMatch(/^import .* from ["']mermaid["'];/m);
    expect(source).toContain('securityLevel: "strict"');
    expect(source).toContain("startOnLoad: false");
    expect(source).toContain("wrapSvgArtifact(svg)");
  });

  it("builds the sidebar shelf label from workspace vocabulary", () => {
    const source = read("src/components/layout/SidebarNav.tsx");
    expect(source).toContain("mcpVocabFor(profile?.org_type).container");
    expect(source).toContain('`No ${containerWord}`');
    expect(source).not.toContain('>Unmapped<');
    expect(mcpVocabFor("company").container).toBe("client");
    expect(mcpVocabFor("personal").container).toBe("folder");
    expect(mcpVocabFor("edu").container).toBe("class");
  });

  it("keeps preview mode dims and strips unknown keys", () => {
    expect(guardEventDims("work.preview_mode_changed", { mode: "source", kind: "mermaid", text: "private" })).toEqual({
      keep: true,
      dims: { mode: "source", kind: "mermaid" },
    });
  });
});