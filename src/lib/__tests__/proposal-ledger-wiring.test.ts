// 19 Nov, proposal ledger: where the ledger is wired into paths that already exist. The build rewrites server
// function handlers into stubs under vitest, so these pin the source (the pattern the MAP-1 and MAP-2 guards use);
// what the wired-in calls do is tested for real in proposal-ledger-server.test.ts.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";

const read = (path: string) => readFileSync(path, "utf8");

describe("every ledger server function is auth, then its tested validator and handler", () => {
  const source = read("src/lib/proposal-ledger.functions.ts");
  const pairs: [string, string, string][] = [
    ["boardValueSoFar", "ledgerBoardInput", "boardValueSoFar"],
    ["firmValueSoFar", "ledgerProfileInput", "firmValueSoFar"],
    ["recordProposalStep", "ledgerStepInput", "recordProposalStep"],
    ["removeProposalStep", "ledgerStepInput", "removeProposalStep"],
    ["setProposalValue", "ledgerValueInput", "setProposalValue"],
    ["noteProposalShown", "ledgerShownInput", "noteProposalShown"],
  ];

  it.each(pairs)("%s", (name, validator, handler) => {
    const start = source.indexOf(`export const ${name} = createServerFn`);
    expect(start).toBeGreaterThan(-1);
    const next = source.indexOf("export const ", start + 1);
    const body = source.slice(start, next === -1 ? undefined : next);
    expect(body).toContain(".middleware([requireSupabaseAuth])");
    expect(body).toContain(`.inputValidator(${validator})`);
    expect(body).toContain(`(await import("./proposal-ledger.server")).ledgerHandlers.${handler}(context, data)`);
  });

  it("exports nothing else, and never opens a database itself", () => {
    expect(source.match(/export const /g)).toHaveLength(pairs.length);
    expect(source).not.toMatch(/supabaseAdmin|\.from\(/);
  });

  it("starts every handler with requireFirmMember", () => {
    const server = read("src/lib/proposal-ledger.server.ts");
    const handlers = server.slice(server.indexOf("export const ledgerHandlers"));
    expect(handlers.match(/async \w+\(context: LedgerContext/g)).toHaveLength(pairs.length);
    expect(handlers.match(/ledgerActorFor\(context, data\.profile_id\)/g)).toHaveLength(pairs.length);
    expect(server).toMatch(/export async function ledgerActorFor[\s\S]{0,200}requireFirmMember\(context\.supabase, context\.userId, profileId\)/);
  });

  it("writes only through the admin client, and reads the ledger only through the caller's own", () => {
    const server = read("src/lib/proposal-ledger.server.ts");
    const reads = server.slice(server.indexOf("Reads, with the caller's own client only."), server.indexOf("The server functions' handlers."));
    expect(reads.length).toBeGreaterThan(1_000);
    expect(reads).not.toMatch(/\badmin\s*\.from|\.admin\b|supabaseAdmin/);
    expect(reads).toContain('userDb.from("proposal_ledger")');
    expect(reads).toContain('userDb.from("proposal_ledger_values")');
    for (const write of server.matchAll(/(\w+)(?:\.admin)?\s*\.from\("proposal_ledger(?:_values)?"\)\s*\.(insert|update|upsert|delete)\(/g)) expect(write[0]).toMatch(/^admin|\.admin/);
    expect(server).not.toMatch(/userDb\s*\.from\("proposal_ledger(?:_values)?"\)\s*\.(insert|update|upsert|delete)\(/);
  });
});

describe("a saved draft writes its ledger row, and can never be failed by it", () => {
  const source = read("src/lib/proposal.functions.ts");
  const draftFn = source.slice(source.indexOf("export const draftProposal = createServerFn"), source.indexOf("/** The person's own proposal draft item"));

  it("runs after the draft is saved and placed, outside the block that takes a failed draft back", () => {
    const saved = draftFn.indexOf("throw failure;\n    }");
    const ledger = draftFn.indexOf('await import("./proposal-ledger.server")');
    const done = draftFn.indexOf("return { itemId: itemId!, title, draft };");
    expect(saved).toBeGreaterThan(-1);
    expect(ledger).toBeGreaterThan(saved);
    expect(done).toBeGreaterThan(ledger);
    // Nothing in the clean-up path mentions the ledger: a ledger problem cannot delete the draft.
    expect(draftFn.slice(draftFn.indexOf("} catch (failure) {"), saved)).not.toContain("ledger");
  });

  it("swallows any failure, and passes the saved item id and the saved draft, never model text", () => {
    expect(draftFn).toMatch(/await import\("\.\/proposal-ledger\.server"\)\s*\.then\(\(\{ ledgerAfterDraft \}\) => ledgerAfterDraft\(supabaseAdmin, \{ orgId: profile\.org_id, engagementId: data\.engagement_id, itemId: itemId!, draft \}\)\)\s*\.catch\(\(\) => \{\}\);/);
  });

  it("records the brief date beside the precedent search, never in front of it", () => {
    const findFn = source.slice(source.indexOf("export const findProposalPrecedents = createServerFn"), source.indexOf("type DraftInput"));
    expect(findFn).toMatch(/const ledger = import\("\.\/proposal-ledger\.server"\)[\s\S]*?ledgerAfterBrief\(\{ userDb: context\.supabase, admin: supabaseAdmin, profile \}[\s\S]*?\.catch\(\(\) => \{\}\);/);
    expect(findFn.indexOf("const ledger = import(")).toBeLessThan(findFn.indexOf("await pickPrecedents("));
    expect(findFn.indexOf("await ledger;")).toBeGreaterThan(findFn.indexOf("await pickPrecedents("));
    expect(findFn).toContain("hasBrief: PROPOSAL_BRIEF_FIELDS.some((field) => Boolean(sentBrief[field]))");
  });
});

describe("a finished Red pen run writes its ledger row, and can never be failed by it", () => {
  const source = read("src/lib/red-pen.functions.ts");
  const runFn = source.slice(source.indexOf("export const runRedPenFn"), source.indexOf("export const latestRedPen"));

  it("runs after the run is stored as completed, with the run id and the stored claims", () => {
    const completed = runFn.indexOf("await completeRun(run.id");
    const ledger = runFn.indexOf("ledgerAfterRedPen(");
    expect(completed).toBeGreaterThan(-1);
    expect(runFn.indexOf("ledgerAfterRedPen", completed)).toBeGreaterThan(completed);
    expect(runFn.slice(ledger)).toContain("{ engagementId, itemId: data.item_id, runId: run.id, claims: result.claims }");
    expect(runFn.indexOf("return result;")).toBeGreaterThan(ledger);
  });

  it("swallows any failure, including a missing service key", () => {
    expect(runFn).toMatch(/await \(async \(\) => \{[\s\S]*?client\.server[\s\S]*?ledgerAfterRedPen[\s\S]*?\}\)\(\)\.catch\(\(\) => \{\}\);/);
    // A failed run never reaches the ledger.
    expect(runFn.indexOf("throw error;")).toBeLessThan(runFn.indexOf("ledgerAfterRedPen("));
  });
});

describe("signals that already exist are used instead of asking twice", () => {
  it("Shown to client on a proposal dates sent to client, after the mark is saved, without touching the mark", () => {
    const hook = read("src/hooks/use-client-showings.ts");
    const mark = hook.slice(hook.indexOf("const markMutation"), hook.indexOf("const unmarkMutation"));
    expect(mark.indexOf("if (error) throw error;")).toBeLessThan(mark.indexOf("noteProposalShown"));
    expect(mark).toMatch(/void import\("@\/lib\/proposal-ledger\.functions"\)\s*\.then\(\(\{ noteProposalShown \}\) => noteProposalShown\(\{ data: \{ engagement_id: engagementId, item_id: input\.itemId, profile_id: profileId \} \}\)\)\s*\.catch\(\(\) => \{\}\);/);
    // The browser sends no date: the server reads the stored mark.
    expect(mark.slice(mark.indexOf("noteProposalShown"))).not.toMatch(/shownOn|shown_on/);
  });

  it("the server dates it from the stored mark, with the caller's own read", () => {
    const server = read("src/lib/proposal-ledger.server.ts");
    const note = server.slice(server.indexOf("export async function noteProposalShown"), server.indexOf("Admins and leads only. The amount is parsed"));
    expect(note).toContain('actor.userDb.from("client_showings").select("shown_on")');
    expect(note).toContain("stepInstant(shownOn)");
  });

  it("adds no second place to enter a showing or an outcome", () => {
    const line = read("src/components/firm-brain/ProposalValueLine.tsx");
    expect(line).not.toMatch(/mark_client_showing|client_showings|engagements"\)\s*\.update/);
    expect(read("src/components/canvas-lab/BoardOutcomeDialog.tsx")).not.toContain("proposal-ledger");
  });
});

describe("telemetry", () => {
  it("adds no event: a new name needs registering in the PostHog portal first, so none was added", () => {
    expect(Object.keys(EVENT_DIM_KEYS).filter((name) => name.startsWith("proposal_ledger"))).toEqual([]);
    expect(read("src/lib/telemetry-shared.ts")).not.toContain("proposal_ledger.");
    for (const file of ["src/components/firm-brain/ProposalValueLine.tsx", "src/components/firm/FirmProposalsCard.tsx", "src/lib/proposal-ledger.server.ts"]) expect(read(file)).not.toMatch(/logEvent|recordEvent/);
  });
});
