import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { claimedBand, claimedLine, COACH_SETUP_COPY, type CoachingLinkRow } from "@/lib/coaching-access";
import { claimCoachingLinks } from "@/lib/coaching-claim";
import { listLinkWork } from "@/lib/coaching-links.server";

const SRC = join(process.cwd(), "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

function link(over: Partial<CoachingLinkRow> = {}): CoachingLinkRow {
  return {
    id: "link-1",
    org_id: "org-1",
    subject_profile_id: "subject-1",
    coach_profile_id: "coach-1",
    relation: "outside_coach",
    scope: "all_work",
    access_level: "full_transcript",
    basis: "subject_consent",
    agreement_ref: null,
    consented_at: "2026-09-02T00:00:00Z",
    consent_withdrawn_at: null,
    disclosed_at: null,
    ended_at: null,
    created_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

/** A stand in for the caller's client. The database rule does the filtering. */
function fakeClient(options: {
  workItems: { id: string; type: string; title: string; work_date: string | null; captured_at: string }[];
  exclusions?: string[];
  links?: { basis: string }[];
  claimed?: number;
}) {
  const calls: { rpc: string; args: unknown }[] = [];
  const client = {
    calls,
    rpc: (name: string, args: unknown) => {
      calls.push({ rpc: name, args });
      return Promise.resolve({ data: options.claimed ?? 0, error: null });
    },
    from(table: string) {
      const rows =
        table === "work_items"
          ? options.workItems
          : table === "coaching_item_exclusions"
            ? (options.exclusions ?? []).map((id) => ({ work_item_id: id }))
            : (options.links ?? []);
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      builder["select"] = chain;
      builder["eq"] = chain;
      builder["in"] = chain;
      builder["limit"] = () => Promise.resolve({ data: rows, error: null });
      builder["order"] = chain;
      builder["then"] = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve);
      return builder;
    },
  };
  return client as unknown as Parameters<typeof listLinkWork>[0] & { calls: typeof calls };
}

const ITEMS = [
  { id: "item-1", type: "deck", title: "Board deck", work_date: null, captured_at: "2026-09-03T00:00:00Z" },
  { id: "item-2", type: "memo", title: "Pricing memo", work_date: null, captured_at: "2026-09-04T00:00:00Z" },
];

describe("pass 171 — claimed bands", () => {
  it("bands a claim without ever giving an exact count away", () => {
    expect(claimedBand(0)).toBe("0");
    expect(claimedBand(1)).toBe("1");
    expect(claimedBand(2)).toBe("2-5");
    expect(claimedBand(5)).toBe("2-5");
    expect(claimedBand(6)).toBe("6+");
    expect(claimedBand(40)).toBe("6+");
  });

  it("says plainly what is waiting, and never counts a refusal", () => {
    expect(claimedLine(0)).toContain("Nobody is sharing work with you yet");
    expect(claimedLine(1)).toContain("One person");
    expect(claimedLine(4)).toContain("4 people");
    for (const line of [claimedLine(0), claimedLine(1), claimedLine(4), ...Object.values(COACH_SETUP_COPY)]) {
      expect(line).not.toMatch(/declin|refus|said no/i);
      expect(line).not.toMatch(/telemetry|analytics|track|monitor|score|surveillance|oversight/i);
      expect(line).not.toContain("\u2014");
    }
  });
});

describe("pass 171 — claiming links with the invite code", () => {
  it("calls the database routine with the code and the new profile", async () => {
    const client = fakeClient({ workItems: [], claimed: 2, links: [{ basis: "subject_consent" }, { basis: "subject_consent" }] });
    const outcome = await claimCoachingLinks(client as never, "abc123", "coach-1");
    expect(client.calls[0]).toEqual({
      rpc: "claim_coaching_links",
      args: { p_code: "abc123", p_actor_profile_id: "coach-1" },
    });
    expect(outcome.count).toBe(2);
    expect(outcome.band).toBe("2-5");
    expect(outcome.byBasis).toEqual([{ basis: "subject_consent", band: "2-5" }]);
  });

  it("reports an empty claim as a zero band, not an error", async () => {
    const client = fakeClient({ workItems: [], claimed: 0 });
    const outcome = await claimCoachingLinks(client as never, "abc123", "coach-1");
    expect(outcome.count).toBe(0);
    expect(outcome.byBasis).toEqual([{ basis: "subject_consent", band: "0" }]);
  });
});

describe("pass 171 — a link only coach reads work through the database rule", () => {
  it("an active consented link shows the subject's mapped work", async () => {
    const client = fakeClient({ workItems: ITEMS });
    const rows = await listLinkWork(client, link(), { asSubject: false });
    expect(rows.map((r) => r.id)).toEqual(["item-1", "item-2"]);
  });

  it("a pending link shows the coach nothing at all", async () => {
    const client = fakeClient({ workItems: ITEMS });
    const rows = await listLinkWork(client, link({ consented_at: null }), { asSubject: false });
    expect(rows).toEqual([]);
  });

  it("a withdrawn link shows the coach nothing, with no reason attached", async () => {
    const client = fakeClient({ workItems: ITEMS });
    const rows = await listLinkWork(
      client,
      link({ consent_withdrawn_at: "2026-09-05T00:00:00Z" }),
      { asSubject: false },
    );
    expect(rows).toEqual([]);
  });

  it("a piece the person kept back is absent from their own view of the link", async () => {
    const client = fakeClient({ workItems: ITEMS, exclusions: ["item-2"] });
    const rows = await listLinkWork(client, link(), { asSubject: true });
    expect(rows.map((r) => r.id)).toEqual(["item-1"]);
  });

  it("never reads the private list on the coach path, so the rule stays in one place", async () => {
    const client = fakeClient({ workItems: ITEMS, exclusions: ["item-2"] });
    const rows = await listLinkWork(client, link(), { asSubject: false });
    expect(rows).toHaveLength(2);
  });
});

describe("pass 171 — wiring", () => {
  it("passes the invite code into the link routine when an admin sets up a coach", () => {
    const dialog = read("components/invites/InviteDialog.tsx");
    expect(dialog).toContain('supabase.rpc("create_coaching_link"');
    expect(dialog).toContain("p_invite_code: code");
    expect(dialog).toContain('logEvent("coachlink.created"');
  });

  it("claims links on the coach path of accepting an invite", () => {
    const page = read("routes/join.tsx");
    expect(page).toContain("claimCoachingLinks(supabase, code, profileId as string)");
    expect(page).toContain('logEvent("coachlink.claimed"');
    expect(page).toContain("claimed_band: entry.band");
    expect(page).toContain("claimedLine(outcome.count)");
  });

  it("registers the new name and changes no existing one", () => {
    const registry = read("lib/telemetry-shared.ts");
    expect(registry).toContain('| "coachlink.claimed"');
    expect(registry).toContain('| "coachlink.created"');
    expect(registry).toContain('| "coachlink.consented"');
  });
});

