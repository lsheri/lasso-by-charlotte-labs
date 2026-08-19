import { describe, expect, it } from "vitest";

import {
  fetchShareableEngagements,
  sharedLine,
  type ShareQueryClient,
} from "../coach-share-shared";

const ME = "10e893ad-5853-41d7-95d0-ba742fb68515";
const COACH = "28b1dec6-03f5-414d-9ddf-3693f19bdcff";

type Call = { table: string; columns: string; filters: [string, string, unknown][] };

function stub(responses: Record<string, unknown>[]): { client: ShareQueryClient; calls: Call[] } {
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