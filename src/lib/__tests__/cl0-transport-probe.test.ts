import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { guardEventDims } from "../event-dim-allowlist";

const HANDLER = readFileSync("src/lib/mcp-handler.server.ts", "utf8");

describe("CL-0 transport probe", () => {
  it("keeps all six dims on mcp.transport_probe", () => {
    const dims = {
      meta_keys: "a,b",
      body_meta_keys: "",
      meta_values: "{}",
      header_names: "authorization,content-type",
      header_values: "{}",
      tool_name: "push_thread",
    };
    expect(guardEventDims("mcp.transport_probe", dims).dims).toEqual(dims);
  });

  it("fires only inside the tools/call branch, before the push work", () => {
    const call = HANDLER.indexOf('if (method === "tools/call")');
    const probe = HANDLER.indexOf("recordTransportProbe(owner, request, body, params, name)");
    expect(call).toBeGreaterThan(-1);
    expect(probe).toBeGreaterThan(call);
    expect(probe).toBeLessThan(HANDLER.indexOf('if (name === "push_conversation")'));
    // Not on initialize or tools/list.
    const init = HANDLER.indexOf('if (method === "initialize")');
    const list = HANDLER.indexOf('if (method === "tools/list")');
    expect(probe).toBeGreaterThan(init);
    expect(probe).toBeGreaterThan(list);
  });

  it("is wrapped so a probe error cannot fail the push", () => {
    const probe = HANDLER.slice(
      HANDLER.indexOf("recordTransportProbe(owner, request"),
      HANDLER.indexOf('if (name === "push_conversation")'),
    );
    expect(probe).toContain("catch");
  });

  it("redacts sensitive header values but keeps their names", () => {
    expect(HANDLER).toContain("PROBE_HEADER_VALUE_BLOCK = /auth|token|secret|key|cookie/i");
    expect(HANDLER).toContain("PROBE_META_VALUE_BLOCK = /token|secret|key|auth/i");
    expect(HANDLER).toContain('"[redacted]"');
  });

  it("is marked temporary with the CL-0 name at the probe site", () => {
    expect(HANDLER).toContain("CL-0");
    expect(HANDLER).toContain("TEMPORARY");
  });
});
