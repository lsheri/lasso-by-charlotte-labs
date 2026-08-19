import { describe, expect, it } from "vitest";

import {
  coachResultsLine,
  fetchShareableEngagements,
  groupByClient,
  isShareableEngagement,
  shareResultsLine,
  sharedLine,
  type ShareQueryClient,
} from "../coach-share-shared";

const ME = "10e893ad-5853-41d7-95d0-ba742fb68515";
const COACH = "28b1dec6-03f5-414d-9ddf-3693f19bdcff";

type Call = { table: string; columns: string; filters: [string, string, unknown][] };

function stub(responses: unknown[][]): { client: ShareQueryClient; calls: Call[] } {
  const calls: Call[] = [];
  let index = 0;
  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          const call: Call = { table, columns, filters: [] };
          calls.push(call);
          const data = responses[index++] ?? [];
          const chain = {
            eq(column: string, value: string) {
              call.filters.push(["eq", column, value]);
              return chain;
            },
            neq(column: string, value: string) {
              call.filters.push(["neq", column, value]);
              return chain;
            },
            in(column: string, values: string[]) {
              call.filters.push(["in", column, values]);
              return chain;
            },
            then(resolve: (value: { data: unknown; error: null }) => unknown) {
              return Promise.resolve({ data, error: null }).then(resolve);
            },
          };
          return chain;
        },
      };
    },
  } as unknown as ShareQueryClient;
  return { client, calls };
}

const membership = (id: string, title: string, role = "em") => ({
  engagement_id: id,
  member_role: role,
  engagements: { id, code: "E1", title, client_label: null, clients: null },
});

describe("eligible engagements query shape", () => {
  it("reads memberships for the caller only, never the engagements table", async () => {
    const { client, calls } = stub([
      [membership("b8c86d0a", "DV Architecture review"), membership("f7255117", "Pilot Budget")],
      [],
    ]);
    await fetchShareableEngagements(client, { profileId: ME, coachProfileId: COACH });

    expect(calls.map((c) => c.table)).toEqual(["engagement_members", "engagement_members"]);
    expect(calls.some((c) => c.table === "engagements")).toBe(false);
    expect(calls[0]?.filters).toContainEqual(["eq", "profile_id", ME]);
    expect(calls[0]?.filters).toContainEqual(["neq", "member_role", "coach"]);
  });

  it("scopes the share-state read to the coach and to those engagement ids", async () => {
    const { client, calls } = stub([
      [membership("b8c86d0a", "DV Architecture review"), membership("f7255117", "Pilot Budget")],
      [],
    ]);
    await fetchShareableEngagements(client, { profileId: ME, coachProfileId: COACH });

    expect(calls[1]?.filters).toContainEqual(["eq", "profile_id", COACH]);
    expect(calls[1]?.filters).toContainEqual(["eq", "member_role", "coach"]);
    expect(calls[1]?.filters).toContainEqual(["in", "engagement_id", ["b8c86d0a", "f7255117"]]);
  });

  it("marks current shares and sorts by title", async () => {
    const { client } = stub([
      [membership("f7255117", "Pilot Budget"), membership("b8c86d0a", "DV Architecture review")],
      [
        {
          engagement_id: "f7255117",
          added_at: "2026-08-19T07:40:00.000Z",
          added_by_profile: { display_name: "Liam Sheridan" },
        },
      ],
    ]);
    const rows = await fetchShareableEngagements(client, {
      profileId: ME,
      coachProfileId: COACH,
    });

    expect(rows.map((r) => r.title)).toEqual(["DV Architecture review", "Pilot Budget"]);
    expect(rows[0]?.shared).toBe(false);
    expect(rows[1]?.shared).toBe(true);
    expect(rows[1]?.added_by_name).toBe("Liam Sheridan");
  });

  it("skips the second read when the caller works on nothing", async () => {
    const { client, calls } = stub([[], []]);
    const rows = await fetchShareableEngagements(client, {
      profileId: ME,
      coachProfileId: COACH,
    });
    expect(rows).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it("says nothing about provenance when the row predates the columns", () => {
    expect(sharedLine(null, null)).toBeNull();
    expect(sharedLine("2026-08-19T07:40:00.000Z", null)).toMatch(/^Shared /);
    expect(sharedLine("2026-08-19T07:40:00.000Z", "Liam Sheridan")).toMatch(/by Liam Sheridan$/);
  });
});
const quick = (id: string, title: string) => ({
  engagement_id: id,
  member_role: "em",
  engagements: {
    id,
    code: "GEN",
    title,
    client_label: null,
    clients: { id: `c-${id}`, name: "Personal", quick_folder: true },
  },
});

const filed = (id: string, title: string, clientId: string, clientName: string) => ({
  engagement_id: id,
  member_role: "em",
  engagements: {
    id,
    code: "E1",
    title,
    client_label: null,
    clients: { id: clientId, name: clientName, quick_folder: false },
  },
});

describe("quick folders are never shareable", () => {
  it("leaves the catch all out of the offered list", async () => {
    const { client } = stub([
      [quick("q1", "General work"), filed("b8c86d0a", "DV Architecture review", "c1", "DV")],
      [],
    ]);
    const rows = await fetchShareableEngagements(client, { profileId: ME, coachProfileId: COACH });
    expect(rows.map((r) => r.title)).toEqual(["DV Architecture review"]);
  });

  it("judges shareability off the client flag alone", () => {
    expect(isShareableEngagement({ clients: { quick_folder: true } })).toBe(false);
    expect(isShareableEngagement({ clients: { quick_folder: false } })).toBe(true);
    expect(isShareableEngagement({ clients: null })).toBe(true);
  });
});

describe("grouping by client", () => {
  it("groups per client and pushes unfiled work last", async () => {
    const { client } = stub([
      [
        filed("a", "Pilot Budget", "c2", "Northwind"),
        filed("b", "DV Architecture review", "c1", "DV Partners"),
        {
          ...filed("c", "Loose thread", "c1", "DV Partners"),
          engagements: {
            id: "c",
            code: "E9",
            title: "Loose thread",
            client_label: null,
            clients: null,
          },
        },
      ],
      [],
    ]);
    const rows = await fetchShareableEngagements(client, { profileId: ME, coachProfileId: COACH });
    const groups = groupByClient(rows);
    expect(groups.map((g) => g.name)).toEqual(["DV Partners", "Northwind", "Unfiled"]);
    expect(groups[0]?.engagements.map((e) => e.title)).toEqual(["DV Architecture review"]);
  });
});

describe("multi share reporting is honest", () => {
  const ok = (id: string, label: string) => ({ id, label, ok: true });

  it("names the count and the coach when everything lands", () => {
    expect(shareResultsLine([ok("a", "One"), ok("b", "Two")], "Ada Vale")).toBe(
      "Shared all 2 with Ada Vale.",
    );
  });

  it("reports partial failure with the reason, never as success", () => {
    const line = shareResultsLine(
      [ok("a", "One"), { id: "b", label: "Pilot Budget", ok: false, message: "not permitted" }],
      "Ada Vale",
    );
    expect(line).toBe("Shared 1 of 2. Pilot Budget did not share: not permitted.");
  });

  it("says the same for the coach side of the sheet", () => {
    expect(coachResultsLine([ok("a", "One"), ok("b", "Two")])).toMatch(/^Shared with 2 coaches/);
    expect(coachResultsLine([{ id: "b", label: "Ada Vale", ok: false, message: "refused" }])).toBe(
      "Shared with 0 of 1 coaches. Ada Vale did not share: refused.",
    );
  });
});
