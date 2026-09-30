import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: () => undefined,
}));

import { accountStageOf, resetAccountStageCache } from "../org-type.server";
import { contextProperties } from "../telemetry.server";

const ORG_TYPE = readFileSync("src/lib/org-type.server.ts", "utf8");
const TELEMETRY = readFileSync("src/lib/telemetry.server.ts", "utf8");

beforeEach(() => {
  resetAccountStageCache();
  rpcMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("A-S2 contextProperties", () => {
  const base = {
    environment: "production",
    workspace_type: "company",
    affiliated: false,
    partner: "none",
  };

  it("includes account_stage when given", () => {
    const props = contextProperties({ ...base, account_stage: "pilot" });
    expect(props["account_stage"]).toBe("pilot");
  });

  it("omits account_stage when not given", () => {
    const props = contextProperties(base);
    expect("account_stage" in props).toBe(false);
  });
});

describe("A-S2 accountStageOf", () => {
  it("returns the stage the rpc returns", async () => {
    rpcMock.mockResolvedValue({ data: "pilot", error: null });
    await expect(accountStageOf("o1")).resolves.toBe("pilot");
    expect(rpcMock).toHaveBeenCalledWith("account_stage", { p_org: "o1" });
  });

  it("returns null when the rpc errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "denied" } });
    await expect(accountStageOf("o2")).resolves.toBe(null);
  });

  it("returns null when the rpc throws", async () => {
    rpcMock.mockRejectedValue(new Error("boom"));
    await expect(accountStageOf("o3")).resolves.toBe(null);
  });

  it("returns null with no orgId and never calls the rpc", async () => {
    await expect(accountStageOf(null)).resolves.toBe(null);
    await expect(accountStageOf(undefined)).resolves.toBe(null);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("uses the cache on a second call", async () => {
    rpcMock.mockResolvedValue({ data: "customer", error: null });
    await expect(accountStageOf("o4")).resolves.toBe("customer");
    await expect(accountStageOf("o4")).resolves.toBe("customer");
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });
});

describe("A-S2 events row stays clean", () => {
  it("WorkspaceStamp and the events insert never contain account_stage", () => {
    const stampBlock = ORG_TYPE.slice(ORG_TYPE.indexOf("export type WorkspaceStamp"));
    expect(stampBlock).not.toContain("account_stage");
    const insertBlock = TELEMETRY.slice(
      TELEMETRY.indexOf('supabase.from("events").insert({'),
      TELEMETRY.indexOf("if (error)"),
    );
    expect(insertBlock).not.toContain("account_stage");
    expect(insertBlock).not.toContain("accountStage");
  });
});
