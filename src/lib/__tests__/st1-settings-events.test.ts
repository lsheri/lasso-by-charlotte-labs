import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const recorded: Record<string, unknown>[] = [];
vi.mock("../telemetry.server", () => ({
  recordEvent: async (_s: unknown, input: Record<string, unknown>) => {
    recorded.push(input);
  },
}));

import { EVENT_DIM_KEYS } from "../event-dim-allowlist";
import { SETTINGS_KEYS, settingsChangedDims } from "../settings-events";
import { recordSettingsChanged } from "../settings-events.server";

beforeEach(() => {
  recorded.length = 0;
});

describe("S-T1 closed vocabulary", () => {
  it("keeps a fixed setting list", () => {
    expect(SETTINGS_KEYS).toContain("data_level_workspace");
    expect(SETTINGS_KEYS).toContain("mcp_url_regenerated");
  });

  it("drops unknown keys, sections, changes and levels", () => {
    expect(settingsChangedDims({ section: "workspace", setting: "free text", change: "updated" })).toBeNull();
    expect(settingsChangedDims({ section: "nope", setting: "connector", change: "removed" })).toBeNull();
    expect(settingsChangedDims({ section: "connectors", setting: "connector", change: "x" })).toBeNull();
    expect(
      settingsChangedDims({ section: "privacy", setting: "data_level_personal", change: "updated", to_level: "z" }),
    ).toBeNull();
  });

  it("keeps to_level only on data levels", () => {
    expect(
      settingsChangedDims({ section: "connectors", setting: "connector", change: "removed", to_level: "b" }),
    ).toEqual({ section: "connectors", setting: "connector", change: "removed" });
  });

  it("allows only the four dim keys", () => {
    expect(EVENT_DIM_KEYS["settings.changed"]).toEqual(["section", "setting", "change", "to_level"]);
  });
});

describe("S-T1 call sites carry no free text", () => {
  const sites = [
    "src/lib/connectors.functions.ts",
    "src/lib/data-consent.functions.ts",
    "src/components/settings/NamingConventionsCard.tsx",
  ];
  it("passes only literals or the closed tier into the dims", () => {
    for (const file of sites) {
      const text = readFileSync(file, "utf8");
      const calls = text.split(/recordSettingsChanged\(|settingsChangedDims\(\{/).slice(1);
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        const body = call.slice(0, call.indexOf(");"));
        expect(body).not.toMatch(/\bvalue\b|display_name|email|title|url:|domain|label|name:/);
      }
    }
  });
});

describe("S-T1 server save", () => {
  it("records settings.changed with the right dims", async () => {
    await recordSettingsChanged(
      {} as never,
      { orgId: "org-1", userId: "u-1", profileId: "p-1" },
      { section: "privacy", setting: "data_level_workspace", change: "updated", to_level: "c" },
    );
    expect(recorded).toEqual([
      {
        eventType: "settings.changed",
        orgId: "org-1",
        userId: "u-1",
        profileId: "p-1",
        dims: { section: "privacy", setting: "data_level_workspace", change: "updated", to_level: "c" },
      },
    ]);
  });

  it("records nothing for an unknown setting", async () => {
    await recordSettingsChanged(
      {} as never,
      { orgId: "org-1", userId: "u-1", profileId: null },
      { section: "workspace", setting: "anything", change: "updated" },
    );
    expect(recorded).toEqual([]);
  });
});
