import { describe, expect, it } from "vitest";

import {
  closeEpisodePayload,
  isCloseChoice,
  isStatusChoice,
  REOPEN_SUPPORTED,
  STATUS_EXPLAINER,
  STATUS_MENU,
  WORKSTREAM_STATUS_LABELS,
} from "../workstream-status";
import { taskLifecyclePatch } from "../firm-dashboard-shared";

describe("workstream status menu wiring", () => {
  it("offers the four states in order with the agreed labels", () => {
    expect(STATUS_MENU.map((o) => [o.value, o.label])).toEqual([
      ["open", "Open"],
      ["delivered", "Delivered"],
      ["accepted", "Accepted"],
      ["abandoned", "Set aside"],
    ]);
  });

  it("offers Open now that closeEpisode accepts a reopen", () => {
    expect(REOPEN_SUPPORTED).toBe(true);
    expect(STATUS_MENU.find((o) => o.value === "open")?.enabled).toBe(true);
    expect(STATUS_MENU.filter((o) => o.enabled).map((o) => o.value)).toEqual([
      "open",
      "delivered",
      "accepted",
      "abandoned",
    ]);
  });

  it("builds the reopen payload the same way as a close", () => {
    expect(closeEpisodePayload("ep-1", "open", "p-1")).toEqual({
      episode_id: "ep-1",
      status: "open",
      profile_id: "p-1",
    });
    expect(isStatusChoice("open")).toBe(true);
    expect(isStatusChoice("closed")).toBe(false);
  });

  it("builds exactly the payload closeEpisode validates", () => {
    expect(closeEpisodePayload("ep-1", "accepted", "p-1")).toEqual({
      episode_id: "ep-1",
      status: "accepted",
      profile_id: "p-1",
    });
    expect(closeEpisodePayload("ep-1", "abandoned", undefined).profile_id).toBeUndefined();
  });

  it("only routes close reasons closeEpisode accepts", () => {
    for (const value of ["delivered", "accepted", "abandoned"]) {
      expect(isCloseChoice(value)).toBe(true);
    }
    expect(isCloseChoice("open")).toBe(false);
    expect(isCloseChoice("closed")).toBe(false);
  });

  it("keeps the set-aside wording and the explainer copy", () => {
    expect(taskLifecyclePatch("open", "2026-08-19T00:00:00Z", "2026-08-01T00:00:00Z")).toEqual({
      status: "open",
      delivered_at: null,
      accepted_at: null,
    });
    expect(WORKSTREAM_STATUS_LABELS["abandoned"]).toBe("Set aside");
    expect(STATUS_EXPLAINER).toBe(
      "Record what happened to this deliverable. This is yours; nobody is grading it.",
    );
    expect(STATUS_EXPLAINER).not.toMatch(/—/);
  });
});