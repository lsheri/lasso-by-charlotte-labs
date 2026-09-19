// @vitest-environment jsdom
/**
 * Canvas Lab polish 2c-iv: "What fed this" claims nothing while it reads.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/rendition.functions", () => ({ getRenditionUrl: async () => null }));
vi.mock("@/components/peek/RenderedContent", () => ({ RenderedContent: () => <div /> }));
vi.mock("@/components/provenance/AnchorPane", () => ({ AnchorPane: () => <div /> }));
vi.mock("@/components/provenance/SlidesPane", () => ({ SlidesPane: () => <div /> }));
vi.mock("@/hooks/use-decisions", () => ({ srcsOf: () => [] }));
vi.mock("@/components/work/SourceMark", () => ({ SourceMark: () => <span /> }));

let audit: () => Promise<unknown> = async () => ({ anchor: {}, upstream: [], stitches: [] });
vi.mock("@/lib/span-provenance.functions", () => ({ getSpanAudit: () => audit() }));

const { CanvasLabReview } = await import("@/components/canvas-lab/CanvasLabReview");

afterEach(cleanup);

function renderReview() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CanvasLabReview
        item={{ id: "w1", title: "A deck" } as never}
        anchorNodeId="n1"
        links={[]}
        decisions={[]}
        nodes={[]}
        comments={[]}
        onTrailSelect={() => undefined}
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  );
}

describe("what fed this", () => {
  it("shows only the reading line while the record is being read", () => {
    let release: (value: unknown) => void = () => undefined;
    audit = () => new Promise((resolve) => { release = resolve; });
    renderReview();
    expect(screen.getByText("Reading the record…")).toBeTruthy();
    expect(screen.queryByText("Context")).toBeNull();
    expect(screen.queryByText("Human judgment")).toBeNull();
    expect(screen.queryByText("Nothing attached here.")).toBeNull();
    expect(screen.queryByText("No decision with an attached source appears here.")).toBeNull();
    release({ anchor: {}, upstream: [], stitches: [] });
  });

  it("shows an empty human judgment line once the record has been read", async () => {
    audit = async () => ({ anchor: {}, upstream: [], stitches: [] });
    renderReview();
    await waitFor(() => expect(screen.getByText("Human judgment")).toBeTruthy());
    expect(screen.getAllByText("Nothing attached here.").length).toBe(3);
  });
});
