// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  COACHING_COPY,
  accessSentence,
  isStructural,
  linkDims,
  linkState,
  needsDisclosure,
  neutralLabel,
  type CoachingLinkRow,
} from "@/lib/coaching-access";

function link(over: Partial<CoachingLinkRow> = {}): CoachingLinkRow {
  return {
    id: "link-1",
    org_id: "org-1",
    subject_profile_id: "subject-1",
    coach_profile_id: "coach-1",
    relation: "outside_coach",
    scope: "all_work",
    access_level: "structural",
    basis: "subject_consent",
    agreement_ref: null,
    consented_at: null,
    consent_withdrawn_at: null,
    disclosed_at: null,
    ended_at: null,
    created_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

describe("pass 170 — coaching link state", () => {
  it("a consent link grants nothing until it is agreed to", () => {
    expect(linkState(link())).toBe("pending");
    expect(linkState(link({ consented_at: "2026-09-02T00:00:00Z" }))).toBe("active");
  });

  it("withdrawal reads as withdrawn, and an ended link as ended", () => {
    expect(
      linkState(link({ consented_at: "x", consent_withdrawn_at: "y" })),
    ).toBe("withdrawn");
    expect(linkState(link({ consented_at: "x", ended_at: "z" }))).toBe("ended");
  });

  it("a firm policy link is active on creation and needs saying once", () => {
    const firm = link({ basis: "firm_policy", agreement_ref: "MSA-4" });
    expect(linkState(firm)).toBe("active");
    expect(needsDisclosure(firm)).toBe(true);
    expect(needsDisclosure({ ...firm, disclosed_at: "2026-09-02T00:00:00Z" })).toBe(false);
  });

  it("structural means an outside coach without full transcript", () => {
    expect(isStructural(link())).toBe(true);
    expect(isStructural(link({ access_level: "full_transcript" }))).toBe(false);
    expect(isStructural(link({ relation: "manager" }))).toBe(false);
  });

  it("event dimensions carry the shape of the link and no names", () => {
    const dims = linkDims(link());
    expect(dims).toEqual({
      basis: "subject_consent",
      relation: "outside_coach",
      access_level: "structural",
      scope: "all_work",
    });
    expect(JSON.stringify(dims)).not.toMatch(/subject-1|coach-1|link-1/);
  });
});

describe("pass 170 — neutral labels", () => {
  it("are stable for the same link across sessions", () => {
    expect(neutralLabel("link-1", "eng-1")).toBe(neutralLabel("link-1", "eng-1"));
  });

  it("differ between two links, so two coaches cannot line them up", () => {
    const a = neutralLabel("link-1", "eng-1");
    const b = neutralLabel("link-2", "eng-1");
    expect(a).not.toBe(b);
  });

  it("tell two engagements apart within one link", () => {
    expect(neutralLabel("link-1", "eng-1")).not.toBe(neutralLabel("link-1", "eng-2"));
  });

  it("never contain the real key", () => {
    expect(neutralLabel("link-1", "Acme Bank")).not.toMatch(/Acme/);
  });
});

/** A tiny stand in for the caller's client: enough chain for the work read. */
function fakeClient(rows: Array<Record<string, unknown>>, exclusions: string[]) {
  const builder = (table: string) => {
    const state = { table };
    const chain: Record<string, unknown> = {};
    const self = new Proxy(chain, {
      get(_target, prop) {
        if (prop === "then") return undefined;
        if (prop === "select") {
          return () => self;
        }
        if (prop === "eq" || prop === "order" || prop === "limit") {
          if (state.table === "coaching_item_exclusions" && prop === "eq") {
            return () =>
              Promise.resolve({ data: exclusions.map((id) => ({ work_item_id: id })), error: null });
          }
          if (prop === "limit") return () => Promise.resolve({ data: rows, error: null });
          return () => self;
        }
        return () => self;
      },
    });
    return self as never;
  };
  return { from: builder } as never;
}

describe("pass 170 — what a link shares", () => {
  it("shows nothing at all while the link is pending", async () => {
    const { listLinkWork } = await import("@/lib/coaching-links.server");
    const out = await listLinkWork(fakeClient([{ id: "w1" }], []) as never, link(), {
      asSubject: false,
    });
    expect(out).toEqual([]);
  });

  it("shows nothing once consent is withdrawn", async () => {
    const { listLinkWork } = await import("@/lib/coaching-links.server");
    const out = await listLinkWork(
      fakeClient([{ id: "w1" }], []) as never,
      link({ consented_at: "a", consent_withdrawn_at: "b" }),
      { asSubject: false },
    );
    expect(out).toEqual([]);
  });

  it("labels a structural coach's view without titles", async () => {
    const { listLinkWork } = await import("@/lib/coaching-links.server");
    const rows = [
      { id: "w1", type: "deck", title: "Acme pricing", work_date: null, captured_at: "2026-09-01" },
    ];
    const out = await listLinkWork(
      fakeClient(rows, []) as never,
      link({ consented_at: "a" }),
      { asSubject: false },
    );
    expect(out[0]?.label).not.toMatch(/Acme/);
    expect(out[0]?.label).toBe(neutralLabel("link-1", "w1"));
  });

  it("drops the pieces the person kept back, on their own view of the link", async () => {
    const { listLinkWork } = await import("@/lib/coaching-links.server");
    const rows = [
      { id: "w1", type: "deck", title: "One", work_date: null, captured_at: "2026-09-01" },
      { id: "w2", type: "deck", title: "Two", work_date: null, captured_at: "2026-09-02" },
    ];
    const out = await listLinkWork(
      fakeClient(rows, ["w1"]) as never,
      link({ consented_at: "a", access_level: "full_transcript", relation: "manager" }),
      { asSubject: true },
    );
    expect(out.map((row) => row.id)).toEqual(["w2"]);
  });
});

vi.mock("@/hooks/use-coaching-links", () => ({
  useMyCoachingLinks: () => ({
    data: [
      { ...link(), state: "pending", structural: true, coach_name: "Sam" },
      {
        ...link({ id: "link-2", basis: "firm_policy", agreement_ref: "MSA-4" }),
        state: "active",
        structural: true,
        coach_name: "Ada",
      },
    ],
  }),
  useCoachingLinkAction: () => ({ mutate: vi.fn(), isPending: false }),
  useCoachLinkPeople: () => ({
    data: [
      {
        link_id: "link-3",
        subject_profile_id: "s1",
        subject_name: "Rae",
        state: "withdrawn",
        structural: true,
        relation: "outside_coach",
        access_level: "structural",
        basis: "subject_consent",
      },
    ],
  }),
  useItemExclusions: () => ({ data: [] }),
  useSetItemShared: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe("pass 170 — the surfaces", () => {
  it("the consent screen offers accept and decline as equals", async () => {
    const { CoachingLinkNotices } = await import("@/components/coaching/CoachingLinkNotices");
    render(<CoachingLinkNotices />);
    expect(screen.getByRole("button", { name: COACHING_COPY.pendingAccept })).toBeTruthy();
    expect(screen.getByRole("button", { name: COACHING_COPY.pendingDecline })).toBeTruthy();
    expect(screen.getByText(COACHING_COPY.declineReassurance)).toBeTruthy();
  });

  it("the firm policy notice states, and does not ask", async () => {
    const { CoachingLinkNotices } = await import("@/components/coaching/CoachingLinkNotices");
    const { container } = render(<CoachingLinkNotices />);
    const firm = screen.getAllByText(COACHING_COPY.firmTitle)[0]?.closest("div");
    expect(firm?.textContent ?? "").not.toContain("?");
    expect(screen.getAllByRole("button", { name: COACHING_COPY.firmAcknowledge }).length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain("MSA-4?");
  });

  it("a coach reads access ended with no reason", async () => {
    const { CoachLinkPeople } = await import("@/components/coaching/CoachLinkPeople");
    const { container } = render(<CoachLinkPeople />);
    expect(container.textContent).toContain(COACHING_COPY.accessEnded);
    expect(container.textContent).not.toMatch(/withdrew|withdrawn|declined|reason/i);
  });
});

describe("pass 170 — language laws", () => {
  const banned =
    /\b(scor\w*|monitor\w*|track\w*|surveillance|oversight|governance|compliance|integrity|fluency|gaps?|caught)\b/i;

  it("the shared copy uses none of the forbidden words and no em dashes", () => {
    const copy = [
      ...Object.values(COACHING_COPY),
      accessSentence(link()),
      accessSentence(link({ access_level: "full_transcript" })),
    ].join(" ");
    expect(copy).not.toMatch(banned);
    expect(copy).not.toContain("\u2014");
  });

  it("the new event names are registered", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/telemetry-shared.ts", "utf8"),
    );
    for (const name of [
      "coachlink.created",
      "coachlink.consented",
      "coachlink.disclosed",
      "coachlink.withdrawn",
      "coachlink.ended",
      "coachlink.item_excluded",
      "coachlink.item_restored",
    ]) {
      expect(source).toContain(name);
    }
  });
});
