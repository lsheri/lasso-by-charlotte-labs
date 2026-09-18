import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createLabFrames, createLocalNode, newLabClientKey } from "@/components/canvas-lab/canvas-lab-model";

const read = (path: string) => readFileSync(path, "utf8");
const migration = () => {
  const dir = "drizzle/migrations";
  const file = readdirSync(dir).find((name) => name.includes("workboard_hardening"));
  return read(`${dir}/${file}`);
};

describe("workboard database hardening (0002)", () => {
  it("was added as an additive migration and left 0001 alone", () => {
    const names = readdirSync("drizzle/migrations");
    expect(names.some((name) => name.startsWith("0001_canvas_lab_slice1_workboards"))).toBe(true);
    expect(names.some((name) => name.includes("workboard_hardening"))).toBe(true);
  });

  it("requires an editor for every workboard write, so coaches stay read-only", () => {
    const sql = migration();
    for (const table of ["workboards", "workboard_nodes", "workboard_links"]) {
      expect(sql).toMatch(new RegExp(`create policy ${table}_insert[\\s\\S]{0,600}is_engagement_editor`, "i"));
      expect(sql).toMatch(new RegExp(`create policy ${table}_update[\\s\\S]{0,600}is_engagement_editor`, "i"));
    }
    // Workstream frames were editor-gated when they were first created.
    expect(sql).toMatch(/create policy workboard_frames_update[\s\S]{0,600}is_engagement_editor/i);
  });

  it("refuses spoofed actor, board and tenant values", () => {
    const sql = migration();
    expect(sql).toMatch(/updated_by[\s\S]{0,80}my_profile_ids\(\)/i);
    expect(sql).toMatch(/org_id/i);
    expect(sql).toMatch(/auth\.uid\(\) is null/i);
  });


  it("keeps one card per client key so a retry cannot duplicate a judgment", () => {
    expect(migration()).toMatch(/unique index[\s\S]{0,200}client_key/i);
  });
});

describe("server rules", () => {
  const server = read("src/lib/canvas-lab.server.ts");

  it("checks edit rights before a board can be lazy created", () => {
    const editorGate = server.indexOf("if (!membership.isEditor) return { status: \"forbidden\" };");
    const ensure = server.indexOf("const board = await ensureBoard(");
    expect(editorGate).toBeGreaterThan(-1);
    expect(editorGate).toBeLessThan(ensure);
  });

  it("lets only the author change or archive an authored card", () => {
    expect(server).toContain('owner.kind === "judgment" || owner.kind === "draft"');
    expect(server).toContain("owner.author_profile_id !== profile.id");
  });

  it("returns the existing row when a create is retried", () => {
    expect(server).toContain("insertNodeIdempotent");
    expect(server).toContain('error?.code !== "23505"');
    expect(server).toContain("client_key");
  });

  it("never hard deletes a workboard record", () => {
    expect(server).not.toMatch(/\.delete\(\)/);
  });
});

describe("client rules", () => {
  it("gives every local card its own key", () => {
    const frames = createLabFrames([{ id: "task-1", name: "Discovery" }]);
    const first = createLocalNode("judgment", frames[0], [], "added_constraint");
    const second = createLocalNode("judgment", frames[0], [first], "corrected_ai");
    expect(first.clientKey).toBeTruthy();
    expect(first.clientKey).not.toEqual(second.clientKey);
    expect(newLabClientKey()).not.toEqual(newLabClientKey());
  });

  it("persists an author's card removal as a soft archive", () => {
    const page = read("src/pages/CanvasLabPage.tsx");
    expect(page).toContain('type: "node_archive"');
    expect(page).toContain("This card belongs to a teammate, so only they can remove it.");
  });

  it("hides the remove action on a teammate's judgment", () => {
    const menu = read("src/components/canvas-lab/LabCardMenu.tsx");
    const card = read("src/components/canvas-lab/LabCard.tsx");
    expect(menu).toContain("Only the author can remove this");
    expect(card).toContain('removable={node.kind !== "judgment" || Boolean(node.local)}');
  });

  it("reconciles workstreams, cards and relationships on Load latest", () => {
    const page = read("src/pages/CanvasLabPage.tsx");
    expect(page).toContain("const fresh = await lab.refresh();");
    expect(page).toContain("applyDurableBoard(base, fresh)");
    expect(page).toContain("setFrames(merged.frames)");
    expect(page).toContain("setLinks(merged.links)");
    expect(read("src/hooks/use-canvas-lab.ts")).toContain("const refresh = useCallback");
  });
});
