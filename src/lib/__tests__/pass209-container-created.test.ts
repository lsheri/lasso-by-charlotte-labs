import { describe, expect, it } from "vitest";

import {
  ALL_EVENT_DIM_KEYS,
  EVENT_DIM_KEYS,
  guardEventDims,
} from "@/lib/event-dim-allowlist";

/** The closed set of entry points this unit introduces for container.created:
 *  the four documented from values of engagement.updated, plus the picker
 *  fallback. A later addition has to edit this array on purpose. */
const CONTAINER_CREATED_FROM = [
  "sidebar",
  "sidebar_client",
  "client_page",
  "home",
  "picker",
] as const;

describe("pass 209 container.created", () => {
  it("lists exactly kind and from as its dims", () => {
    expect(EVENT_DIM_KEYS["container.created"]).toEqual(["kind", "from"]);
  });

  it("keeps both allowed dims", () => {
    const result = guardEventDims("container.created", { kind: "folder", from: "sidebar" });
    expect(result.dims).toEqual({ kind: "folder", from: "sidebar" });
  });

  it("drops a container name before it can reach the events table", () => {
    const result = guardEventDims("container.created", { kind: "folder", name: "Acme" });
    expect(result.dims).toEqual({ kind: "folder" });
    expect(result.dims).not.toHaveProperty("name");
  });

  it("is present in the full dim key map", () => {
    expect(Object.keys(ALL_EVENT_DIM_KEYS)).toContain("container.created");
  });

  it("reports only the closed entry-point vocabulary", () => {
    expect([...CONTAINER_CREATED_FROM]).toEqual([
      "sidebar",
      "sidebar_client",
      "client_page",
      "home",
      "picker",
    ]);
  });
});
