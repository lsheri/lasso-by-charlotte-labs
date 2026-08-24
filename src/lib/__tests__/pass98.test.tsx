// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrandLogo, brandForToolkit, type BrandKey } from "@/components/connectors/BrandLogo";
import { dateOnly, defaultWorkDate, driveSourceMeta } from "@/lib/source-dates";

afterEach(() => cleanup());

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useServerFn: () => vi.fn(),
}));

describe("honest source dates", () => {
  it("records the real mime, export mime and both timestamps", () => {
    const meta = driveSourceMeta({
      filename: "Plan.txt",
      storedMime: "text/plain",
      sourceMime: "application/vnd.google-apps.document",
      exportMime: "text/plain",
      createdTime: "2026-01-02T10:00:00Z",
      modifiedTime: "2026-03-04T10:00:00Z",
    });
    expect(meta.mime).toBe("application/vnd.google-apps.document");
    expect(meta.export_mime).toBe("text/plain");
    expect(meta.created_at).toBe("2026-01-02T10:00:00Z");
    expect(meta.modified_at).toBe("2026-03-04T10:00:00Z");
  });

  it("leaves absent provider fields absent rather than inventing them", () => {
    const meta = driveSourceMeta({ filename: "a.pdf", storedMime: "application/pdf" });
    expect(meta.created_at).toBeUndefined();
    expect(meta.modified_at).toBeUndefined();
    expect(meta.mime).toBeUndefined();
  });

  it("never overwrites a work_date that is already set", () => {
    expect(defaultWorkDate("2025-01-01", "2026-03-04T10:00:00Z")).toBe("2025-01-01");
    expect(defaultWorkDate(null, "2026-03-04T10:00:00Z")).toBe("2026-03-04");
    expect(defaultWorkDate(null, null)).toBeNull();
    expect(dateOnly("nonsense")).toBeNull();
  });
});

describe("brand logos", () => {
  const brands: BrandKey[] = [
    "googledrive",
    "gmail",
    "googledocs",
    "googlesheets",
    "googleslides",
    "googlecalendar",
    "onedrive",
    "sharepoint",
    "notion",
    "granola",
    "claude",
    "chatgpt",
    "gemini",
    "upload",
    "thread",
    "unknown",
  ];

  it("renders a mark for every listed vendor and the fallback", () => {
    for (const brand of brands) {
      const { unmount } = render(<BrandLogo brand={brand} />);
      expect(screen.getAllByRole("img").length).toBeGreaterThan(0);
      unmount();
    }
  });

  it("maps connector toolkits to their mark", () => {
    expect(brandForToolkit("googledrive")).toBe("googledrive");
    expect(brandForToolkit("one_drive")).toBe("onedrive");
    expect(brandForToolkit("onedrive")).toBe("onedrive");
    expect(brandForToolkit("sharepoint_graph")).toBe("sharepoint");
    expect(brandForToolkit("granola_mcp")).toBe("granola");
    expect(brandForToolkit("gmail")).toBe("gmail");
  });
});

describe("re-extract affordance", () => {
  const failed = {
    id: "w1",
    title: "Deck.pdf",
    type: "deck",
    source: "connector:googledrive",
    visibility: "unmapped",
    captured_at: "2026-01-01T00:00:00Z",
    content_ref: "u/deck.pdf",
    meta: { text_status: "failed", text_note: "the file could not be opened" },
  } as never;

  it("shows for the owner when the contents could not be read", async () => {
    const { FallbackCard } = await import("@/components/peek/RenderedContent");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FallbackCard item={failed} label="PDF" onDownload={() => {}} canEdit />
      </QueryClientProvider>,
    );
    expect(screen.getByText("Try reading it again")).toBeTruthy();
  });

  it("stays hidden for a reader who does not own the item", async () => {
    const { FallbackCard } = await import("@/components/peek/RenderedContent");
    render(<FallbackCard item={failed} label="PDF" onDownload={() => {}} />);
    expect(screen.queryByText("Try reading it again")).toBeNull();
  });

  it("shows in the Drive embed preview when the owner could not read contents", async () => {
    const { RenderedContent } = await import("@/components/peek/RenderedContent");
    const driveFailed = {
      id: "w2",
      title: "Plan.gdoc",
      type: "doc",
      source: "connector:googledrive",
      visibility: "unmapped",
      captured_at: "2026-01-01T00:00:00Z",
      content_ref: null,
      meta: { drive_file_id: "abc123", text_status: "failed", text_note: "export failed" },
    } as never;
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RenderedContent item={driveFailed} onDownload={() => {}} canEdit />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Try reading it again")).toBeTruthy();
    expect(screen.getByText(/Lasso could not read this file's contents/)).toBeTruthy();
  });
});

