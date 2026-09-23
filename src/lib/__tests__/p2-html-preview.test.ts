import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { noteWorkboardCardContentViewed } from "@/components/canvas-lab/canvas-lab-telemetry";
import { withPreviewCsp, type WorkboardFilePreview } from "@/lib/workboard-card-preview.shared";
import { wrapSvgArtifact } from "@/lib/workboard-file-preview";

const CSP_MARKER = 'http-equiv="Content-Security-Policy"';

describe("P2 HTML and SVG workboard previews", () => {
  it.each([
    ["existing head", "<!doctype html><html><head><title>Artifact</title></head><body>Body</body></html>"],
    ["html without head", "<html><body>Body</body></html>"],
    ["bare fragment", "<main>Body</main>"],
  ])("injects one CSP first in the head for an %s", (_label, source) => {
    const result = withPreviewCsp(source);
    expect(result.match(/http-equiv="Content-Security-Policy"/g)).toHaveLength(1);
    expect(result.indexOf(CSP_MARKER)).toBeGreaterThan(result.indexOf("<head"));
    expect(result.indexOf(CSP_MARKER)).toBeLessThan(result.indexOf("</head>"));
    expect(result.indexOf(CSP_MARKER)).toBeLessThan(result.indexOf("<title>" ) < 0 ? Number.POSITIVE_INFINITY : result.indexOf("<title>"));
  });

  it("replaces an existing CSP rather than adding a second one", () => {
    const result = withPreviewCsp('<html><head><meta http-equiv="Content-Security-Policy" content="default-src *"><title>Artifact</title></head></html>');
    expect(result.match(/http-equiv="Content-Security-Policy"/g)).toHaveLength(1);
    expect(result).toContain("default-src 'none'");
  });

  it("accepts the shared HTML preview shape", () => {
    const preview: WorkboardFilePreview = {
      workItemId: "artifact-1",
      kind: "html",
      url: null,
      html: "<main>Artifact</main>",
      lines: [],
      slideTitle: null,
      versionCount: 0,
    };
    expect(preview.kind).toBe("html");
  });

  it("wraps stored SVG text in an HTML document", () => {
    const svg = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>';
    const result = wrapSvgArtifact(svg);
    expect(result).toContain("<!doctype html>");
    expect(result).toContain(svg);
    expect(result).toContain("svg { max-width: 100%; height: auto; }");
  });

  it("pins the isolated iframe and focus interaction layer in source", () => {
    const previewSource = readFileSync("src/components/canvas-lab/WorkboardFilePreview.tsx", "utf8");
    const labSource = readFileSync("src/components/canvas-lab/LabPreview.tsx", "utf8");
    const cardSource = readFileSync("src/components/canvas-lab/LabCard.tsx", "utf8");
    expect(previewSource).toContain('sandbox="allow-scripts"');
    expect(previewSource).not.toMatch(/sandbox="[^"]*allow-same-origin/);
    expect(previewSource).toContain('referrerPolicy="no-referrer"');
    expect(previewSource).toContain('data-testid="workboard-html-preview"');
    expect(previewSource).toContain('data-testid="workboard-html-preview-overlay"');
    expect(previewSource).toContain('focused ? "pointer-events-none absolute inset-0" : "absolute inset-0"');
    expect(labSource).toContain("focused={focused}");
    expect(cardSource).toContain("focused={focused}");
  });

  it("uses only source_meta.kind and the protected server reader for artifact previews", () => {
    const helperSource = readFileSync("src/lib/workboard-file-preview.ts", "utf8");
    const serverSource = readFileSync("src/lib/workboard-artifact-preview.functions.ts", "utf8");
    expect(helperSource).toContain('kind === "artifact_html"');
    expect(helperSource).toContain('kind === "artifact_svg"');
    expect(serverSource).toContain(".middleware([requireSupabaseAuth])");
    expect(serverSource).toContain("MAX_ARTIFACT_PREVIEW_BYTES = 1024 * 1024");
    expect(serverSource).toContain('.storage.from("work-files").download(item.content_ref)');
  });

  it("allows html on the existing content-viewed event kind", () => {
    expect(() => noteWorkboardCardContentViewed(undefined, "html", "open")).not.toThrow();
  });
});
describe("P2 fix pass: artifact reader access", () => {
  it("checks the row under the caller's session, then downloads with the server client", () => {
    const src = readFileSync("src/lib/workboard-artifact-preview.functions.ts", "utf8");
    const rowCheck = src.indexOf('context.supabase\n      .from("work_items")');
    const adminRead = src.indexOf('supabaseAdmin.storage.from("work-files").download');
    expect(rowCheck).toBeGreaterThan(-1);
    expect(adminRead).toBeGreaterThan(rowCheck);
    expect(src).not.toContain("context.supabase.storage");
    expect(src).toContain('await import("@/integrations/supabase/client.server")');
    expect(src).toContain("MAX_ARTIFACT_PREVIEW_BYTES = 1024 * 1024");
  });
});
