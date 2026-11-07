import { describe, expect, it } from "vitest";

import { ALL_EVENT_DIM_KEYS, EVENT_DIM_KEYS, UNIVERSAL_DIM_KEYS, guardServerEventDims } from "../event-dim-allowlist";
import { HOST_CLASSES, environmentFromHost, hostClassFromHost } from "../environment-shared";

/**
 * AUDIT-1 (7 Nov 2026). The A2 truth table found two server-emitted dims
 * (context_share, catalogue_fallback) reaching the events table without an
 * allowlist entry, because the server path never ran the guard. These pin
 * the widened lists and the new server guard.
 */
describe("AUDIT-1: the allowlist carries every dim the server emits", () => {
  it("reflect.message_sent lists the read-set dims", () => {
    expect(EVENT_DIM_KEYS["reflect.message_sent"]).toEqual(expect.arrayContaining(["context_share", "catalogue_fallback"]));
  });

  it("the two other live gaps from the 30-day read are closed", () => {
    expect(EVENT_DIM_KEYS["connector.browse_result"]).toEqual(expect.arrayContaining(["reason", "result_band", "tool_chosen"]));
    expect(EVENT_DIM_KEYS["mcp.container_created"]).toEqual(expect.arrayContaining(["entity", "outcome"]));
  });

  it("the universal keys are the host bucket only", () => {
    expect([...UNIVERSAL_DIM_KEYS]).toEqual(["host_class"]);
  });
});

describe("AUDIT-1: guardServerEventDims", () => {
  it("keeps listed keys, drops unlisted ones, and names what it dropped", () => {
    const out = guardServerEventDims("reflect.message_sent", {
      context_share: "100",
      scope: "board",
      smuggled: "no",
    });
    expect(out.dims).toEqual({ context_share: "100", scope: "board" });
    expect(out.dropped).toEqual(["smuggled"]);
  });

  it("keeps the host bucket on any event", () => {
    const out = guardServerEventDims("presence.active", { host_class: "lovable_project", week_start: "2026-11-02" });
    expect(out.dims).toEqual({ host_class: "lovable_project", week_start: "2026-11-02" });
  });

  it("covers workboard events through the union", () => {
    expect(ALL_EVENT_DIM_KEYS["workboard.pasted"]).toEqual(expect.arrayContaining(["what", "outcome", "via"]));
    const out = guardServerEventDims("workboard.pasted", { what: "image", outcome: "added", via: "menu", title: "x" });
    expect(out.dims).toEqual({ what: "image", outcome: "added", via: "menu" });
  });

  it("an unlisted event name keeps no dims but the host bucket", () => {
    const out = guardServerEventDims("not.an.event", { host_class: "other", anything: "y" });
    expect(out.dims).toEqual({ host_class: "other" });
  });
});

describe("AUDIT-1: hostClassFromHost is a closed bucket, never the host", () => {
  it("buckets the hosts that produce an unknown environment", () => {
    expect(hostClassFromHost("abc-123.lovableproject.com")).toBe("lovable_project");
    expect(hostClassFromHost("id-preview--x.lovable.app")).toBe("lovable_app");
    expect(hostClassFromHost("www.charlotte-labs.com:443")).toBe("charlotte_labs");
    expect(hostClassFromHost("127.0.0.1:3000")).toBe("loopback");
    expect(hostClassFromHost("example.org")).toBe("other");
    expect(hostClassFromHost(undefined)).toBe("none");
    expect(hostClassFromHost("")).toBe("none");
  });

  it("every bucket is in the closed list", () => {
    for (const host of ["a.lovableproject.com", "a.lovable.app", "lasso.charlotte-labs.com", "localhost", "x.y", null]) {
      expect(HOST_CLASSES).toContain(hostClassFromHost(host));
    }
  });

  it("does not change what environmentFromHost says", () => {
    expect(environmentFromHost("lasso.charlotte-labs.com")).toBe("production");
    expect(environmentFromHost("a.lovable.app")).toBe("preview");
    expect(environmentFromHost("a.lovableproject.com")).toBe("unknown");
  });
});
