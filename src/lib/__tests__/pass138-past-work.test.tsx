import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { coachNavGroups, navGroups } from "@/components/layout/nav-config";
import {
  PAST_WORK_EMPTY_LINE,
  PAST_WORK_EVENT,
  PAST_WORK_FOOTER_LINE,
  PAST_WORK_HINT,
  PAST_WORK_MATCH_CAP,
  PAST_WORK_NAV_LABEL,
  PAST_WORK_PLACEHOLDER,
  validatePastWorkMatches,
  type PastWorkCandidate,
} from "@/lib/past-work-shared";
import {
  assemblePastWorkCandidates,
  PAST_WORK_GATEWAY_TABLE,
  PAST_WORK_SUMMARY_TABLE,
} from "@/lib/past-work.server";

const NEW_FILES = [
  "src/lib/past-work-shared.ts",
  "src/lib/past-work.server.ts",
  "src/lib/past-work.functions.ts",
  "src/components/archive/PastWorkSearch.tsx",
];

/** A caller stub that records every table it is asked for. */
function fakeCaller(rows: Record<string, unknown[]>) {
  const tables: string[] = [];
  function builder(table: string) {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "order", "limit", "in", "eq"]) {
      chain[method] = () => chain;
    }
    chain["then"] = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: rows[table] ?? [], error: null });
    return chain;
  }
  return {
    tables,
    client: {
      from(table: string) {
        tables.push(table);
        return builder(table);
      },
    },
  };
}

const candidate = (id: string): PastWorkCandidate => ({
  work_item_id: id,
  title: `Piece ${id}`,
  kind: "deck",
  deliverable_kind: null,
  file_format: null,
  mime_type: null,
  filename: null,

  engagement_id: "e1",
  engagement_code: "ENG-1",
  engagement_title: "Pricing refresh",
  client_label: "Northwind",
  brief: null,
  summary: null,
});

describe("Pass 138: Past work nav", () => {
  it("sits in What you learned, directly under Where it goes", () => {
    const labels = navGroups.map((group) => group.label);
    // Nav is now ordered by the weekly loop rather than by object type.
    expect(labels).toEqual(["What landed", "Where it goes", "What you learned", "Run the firm", "Your account"]);
    expect(labels.indexOf("What you learned")).toBe(labels.indexOf("Where it goes") + 1);

    const learned = navGroups.find((group) => group.label === "What you learned")!;
    expect(learned.items[0]).toEqual({ label: PAST_WORK_NAV_LABEL, to: "/archive", icon: "firm" });
    expect(PAST_WORK_NAV_LABEL).toBe("Past work");
  });

  it("members and admins reach it; coaches do not", () => {
    // Workers and admins share navGroups; the Firm group is never role gated.
    const worker = navGroups.flatMap((group) => group.items).filter((i) => i.to === "/archive");
    expect(worker).toHaveLength(1);
    expect(worker[0]!.label).toBe(PAST_WORK_NAV_LABEL);

    const coach = coachNavGroups.flatMap((group) => group.items).filter((i) => i.to === "/archive");
    expect(coach).toHaveLength(0);
  });

  it("one name per feature: no synonyms in the new files", () => {
    for (const file of NEW_FILES) {
      const text = readFileSync(file, "utf8").toLowerCase();
      for (const synonym of ["library", "knowledge base", "repository"]) {
        expect(text).not.toContain(synonym);
      }
    }
  });
});

describe("Pass 138: copy", () => {
  it("pins the placeholder and the lines under it", () => {
    expect(PAST_WORK_PLACEHOLDER).toBe("What are you working on?");
    expect(PAST_WORK_HINT).toBe(
      "Describe the work and Lasso finds shipped work like it, with why it matches.",
    );
    expect(PAST_WORK_EMPTY_LINE).toBe(
      "Nothing shipped yet looks like this. Past work grows as work ships.",
    );
    expect(PAST_WORK_FOOTER_LINE).toBe("Reads shipped work only.");
  });

  it("no banned words and no em dashes in the new files", () => {
    const banned = [
      "score",
      "scored",
      "scoring",
      "monitor",
      "monitoring",
      "track",
      "tracked",
      "surveillance",
      "oversight",
      "governance",
      "compliance",
      "integrity",
      "fluency",
      "deficiencies",
      "caught",
    ];
    for (const file of NEW_FILES) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toContain("\u2014");
      const lower = text.toLowerCase();
      for (const word of banned) {
        expect(new RegExp(`\\b${word}\\b`).test(lower), `${word} in ${file}`).toBe(false);
      }
      // "gaps" is banned as a word; tracking-* class names are absent too.
      expect(/\bgaps\b/.test(lower)).toBe(false);
    }
  });
});

describe("Pass 138: candidate assembly", () => {
  it("reads shipped_work as the only gateway, plus summaries of those ids", async () => {
    const caller = fakeCaller({
      shipped_work: [
        {
          work_item_id: "w1",
          engagement_id: "e1",
          work_items: { title: "Pricing deck", type: "deck" },
          engagements: {
            code: "ENG-1",
            title: "Pricing refresh",
            client_label: "Northwind",
            brief: "Rebuild the pricing story.",
          },
        },
      ],
      work_item_extracts: [{ work_item_id: "w1", summary: "A deck built in three passes." }],
    });

    const candidates = await assemblePastWorkCandidates(caller.client as never);

    expect(caller.tables).toEqual([PAST_WORK_GATEWAY_TABLE, PAST_WORK_SUMMARY_TABLE]);
    expect(caller.tables).not.toContain("work_items");
    expect(caller.tables).not.toContain("turns");
    expect(caller.tables).not.toContain("chat_messages");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.title).toBe("Pricing deck");
    expect(candidates[0]!.summary).toBe("A deck built in three passes.");
  });

  it("no shipped rows means no candidates and no second read", async () => {
    const caller = fakeCaller({ shipped_work: [] });
    expect(await assemblePastWorkCandidates(caller.client as never)).toEqual([]);
    expect(caller.tables).toEqual([PAST_WORK_GATEWAY_TABLE]);
  });

  it("drops ids the candidate set does not know and clamps to five", () => {
    const candidates = ["a", "b", "c", "d", "e", "f"].map(candidate);
    const raw = {
      matches: [
        { work_item_id: "ghost", why: "invented", look_at: "nothing" },
        ...candidates.map((c) => ({
          work_item_id: c.work_item_id,
          why: "Same shape of deliverable.",
          look_at: "Open the brief.",
        })),
      ],
    };
    const matches = validatePastWorkMatches(raw, candidates);
    expect(matches).toHaveLength(PAST_WORK_MATCH_CAP);
    expect(matches.map((m) => m.work_item_id)).not.toContain("ghost");
  });
});

describe("Pass 138: telemetry", () => {
  it("archive.search is the only new event name", () => {
    expect(PAST_WORK_EVENT).toBe("archive.search");
    const server = readFileSync("src/lib/past-work.server.ts", "utf8");
    const names = [...server.matchAll(/eventType:\s*"([^"]+)"/g)].map((hit) => hit[1]);
    expect([...new Set(names)]).toEqual(["archive.search"]);
    expect(server).toContain("had_results");
    expect(server).toContain("result_count");
  });
});
