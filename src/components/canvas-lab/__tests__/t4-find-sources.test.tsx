// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DeliverableEvidence, EvidenceLink } from "@/lib/lineage.functions";

const calls = { draft: vi.fn(), review: vi.fn() };
const evidence: { value: DeliverableEvidence } = {
  value: { links: [], prompts: [], vendorVisible: true, isOwner: true, versions: [] },
};
vi.mock("@/lib/lineage.functions", () => ({
  getDeliverableEvidence: "load",
  draftLineage: "draft",
  reviewLink: "review",
}));
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: string) => {
    if (fn === "load") return async () => evidence.value;
    if (fn === "draft") return async (args: unknown) => calls.draft(args);
    return async (args: unknown) => calls.review(args);
  },
}));

import { TRAIL_SOURCES_COPY, TrailSources } from "@/components/canvas-lab/TrailSources";
import { liftZoom } from "@/lib/lift-view";

afterEach(() => {
  cleanup();
  calls.draft.mockReset();
  calls.review.mockReset();
  evidence.value = { links: [], prompts: [], vendorVisible: true, isOwner: true, versions: [] };
});

const draftLink = (id: string, over: Partial<EvidenceLink> = {}): EvidenceLink => ({
  id,
  relation: "informed",
  rationale: 'Both say "212 students declared CS interest".',
  status: "draft",
  item: { id: `item-${id}`, title: `Enrollment model ${id}`, type: "sheet", visibility: "engagement", date: "2026-10-01", source_vendor: null, kind: null },
  ...over,
});

function mount(onChanged = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TrailSources workItemId="deck" profileId="me" onChanged={onChanged} />
    </QueryClientProvider>,
  );
  return { onChanged };
}

describe("T4 Find possible sources: suggestions, never claims", () => {
  it("with nothing drafted yet, offers to look and says what it reads and that nothing joins without you", async () => {
    mount();
    expect(await screen.findByRole("button", { name: TRAIL_SOURCES_COPY.find })).toBeTruthy();
    expect(screen.getByText(TRAIL_SOURCES_COPY.fine)).toBeTruthy();
  });

  it("looking runs the evidence-only drafter for this piece, then shows what it found with its reason", async () => {
    calls.draft.mockImplementation(async () => {
      evidence.value = { ...evidence.value, links: [draftLink("a")] };
      return { drafted: 1, considered: 6, skippedExisting: 0 };
    });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: TRAIL_SOURCES_COPY.find }));
    expect(await screen.findByText("Enrollment model a")).toBeTruthy();
    expect(screen.getByText('Both say "212 students declared CS interest".')).toBeTruthy();
    expect(calls.draft).toHaveBeenCalledWith({ data: { work_item_id: "deck", profile_id: "me" } });
  });

  it("when nothing matches, it says so plainly", async () => {
    calls.draft.mockResolvedValue({ drafted: 0, considered: 6, skippedExisting: 0 });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: TRAIL_SOURCES_COPY.find }));
    expect(await screen.findByText(TRAIL_SOURCES_COPY.none)).toBeTruthy();
  });

  it("Link it confirms the link through the existing review, from the trail, and refreshes the trail", async () => {
    evidence.value = { ...evidence.value, links: [draftLink("a")] };
    calls.review.mockImplementation(async () => {
      evidence.value = { ...evidence.value, links: [draftLink("a", { status: "confirmed" })] };
      return { ok: true };
    });
    const { onChanged } = mount();
    fireEvent.click(await screen.findByRole("button", { name: TRAIL_SOURCES_COPY.link }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(calls.review).toHaveBeenCalledWith({ data: { link_id: "a", action: "confirmed", profile_id: "me", surface: "trail" } });
    await waitFor(() => expect(screen.queryByTestId("trail-suggestion")).toBeNull());
  });

  it("Not this keeps the answer (discarded), so it is not suggested again, and leaves the trail alone", async () => {
    evidence.value = { ...evidence.value, links: [draftLink("a")] };
    calls.review.mockImplementation(async () => {
      evidence.value = { ...evidence.value, links: [draftLink("a", { status: "discarded" })] };
      return { ok: true };
    });
    const { onChanged } = mount();
    fireEvent.click(await screen.findByRole("button", { name: TRAIL_SOURCES_COPY.dismiss }));
    await waitFor(() => expect(screen.queryByTestId("trail-suggestion")).toBeNull());
    expect(calls.review).toHaveBeenCalledWith({ data: { link_id: "a", action: "discarded", profile_id: "me", surface: "trail" } });
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("only drafts are suggested; confirmed and discarded links are not shown here", async () => {
    evidence.value = { ...evidence.value, links: [draftLink("c", { status: "confirmed" }), draftLink("d", { status: "discarded" })] };
    mount();
    expect(await screen.findByRole("button", { name: TRAIL_SOURCES_COPY.find })).toBeTruthy();
    expect(screen.queryByTestId("trail-suggestion")).toBeNull();
  });

  it("a failure says so and does not pretend", async () => {
    calls.draft.mockRejectedValue(new Error("boom"));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: TRAIL_SOURCES_COPY.find }));
    expect(await screen.findByText(TRAIL_SOURCES_COPY.failed)).toBeTruthy();
  });
});

describe("T4 on the board and in the trail (pinned in source)", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  const trail = readFileSync("src/components/canvas-lab/LiftedTrail.tsx", "utf8");
  const sources = readFileSync("src/components/canvas-lab/TrailSources.tsx", "utf8");
  it("only the owner of a deck, document or sheet sees it, as the drafter allows", () => {
    expect(page).toContain("canFindSources={ownsWorkItem(profile, liftedItem) && isDeliverableType(liftedItem.type)}");
  });
  it("a confirmed suggestion refreshes the trail it joins", () => {
    expect(trail).toContain('onChanged={() => void queryClient.invalidateQueries({ queryKey: ["trail", workItemId] })}');
  });
  it("never shows a count or who made a link", () => {
    expect(Object.values(TRAIL_SOURCES_COPY).join(" ")).not.toMatch(/\d|owner|author|teammate|by you|by \w+ \w+/i);
    expect(sources).not.toMatch(/\{\s*(result\.)?(drafted|considered)\s*\}/);
  });
});

describe("T4 a chat beside the open Trail is not cut off", () => {
  it("the work scales down to fit the narrower body, never past three quarters", () => {
    expect(liftZoom(420)).toBe(0.78);
    expect(liftZoom(200)).toBe(0.75);
  });
});
