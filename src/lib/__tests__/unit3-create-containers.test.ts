import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inserts: [] as Record<string, unknown>[],
  events: [] as { name: string; dims: Record<string, unknown> }[],
  toasts: [] as string[],
  refuse: null as string | null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        mocks.inserts.push(row);
        return { error: mocks.refuse ? { message: mocks.refuse } : null };
      },
    }),
  },
}));
vi.mock("@/lib/telemetry", () => ({
  logEvent: (name: string, _o: string, dims: Record<string, unknown>) => mocks.events.push({ name, dims }),
}));
vi.mock("sonner", () => ({ toast: { error: (m: string) => mocks.toasts.push(m), success: vi.fn() } }));

import { createContainer, depthFor } from "@/components/engagements/create-container";
import type { ClientRow } from "@/hooks/use-clients";

const rows: ClientRow[] = [
  { id: "c", name: "A", code: null, quick_folder: false, kind: "client", parent_id: null },
  { id: "f1", name: "B", code: null, quick_folder: false, kind: "folder", parent_id: "c" },
  { id: "f2", name: "C", code: null, quick_folder: false, kind: "folder", parent_id: "f1" },
];

beforeEach(() => {
  mocks.inserts = [];
  mocks.events = [];
  mocks.toasts = [];
  mocks.refuse = null;
});

describe("unit 3 creating containers", () => {
  it("counts depth from the top", () => {
    expect(depthFor(null, rows)).toBe(1);
    expect(depthFor("c", rows)).toBe(2);
    expect(depthFor("f2", rows)).toBe(4);
  });

  it("writes a folder under its parent, never quick_folder, and records client.created", async () => {
    const id = await createContainer({
      orgId: "o", orgType: "partner", name: "Acme", kind: "folder", parentId: "f1", rows, from: "picker",
    });
    expect(id).toBeTruthy();
    expect(mocks.inserts[0]).toMatchObject({ kind: "folder", parent_id: "f1" });
    expect(mocks.inserts[0]).not.toHaveProperty("quick_folder");
    const created = mocks.events.find((e) => e.name === "client.created");
    expect(created?.dims).toEqual({ workspace_type: "partner", kind: "folder", from_empty: "false", depth: "3" });
    expect(JSON.stringify(mocks.events)).not.toContain("Acme");
  });

  it("keeps a client at the top whatever parent is passed", async () => {
    await createContainer({ orgId: "o", orgType: "company", name: "X", kind: "client", parentId: "c", rows, from: "empty_state" });
    expect(mocks.inserts[0]).not.toHaveProperty("parent_id");
    expect(mocks.events.find((e) => e.name === "client.created")?.dims).toMatchObject({ from_empty: "true", depth: "1" });
  });

  it("shows the database refusal as it came back and records nothing", async () => {
    mocks.refuse = "Folders go three deep. Move this one higher up, or put the work straight on a workboard";
    const id = await createContainer({ orgId: "o", orgType: "company", name: "D", kind: "folder", parentId: "f2", rows, from: "picker" });
    expect(id).toBeNull();
    expect(mocks.toasts).toEqual([mocks.refuse]);
    expect(mocks.events).toEqual([]);
  });
});
