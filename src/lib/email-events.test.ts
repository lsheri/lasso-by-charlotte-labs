import { describe, expect, it } from "vitest";

import { shouldApply, statusForEvent } from "./email-events";

describe("email delivery events", () => {
  it("applies delivered after sent", () => {
    expect(shouldApply("sent", statusForEvent("email.delivered")!)).toBe(true);
  });

  it("does not let a late sent overwrite delivered", () => {
    expect(shouldApply("delivered", statusForEvent("email.sent")!)).toBe(false);
  });

  it("treats a redelivered delivered event as a no-op", () => {
    const s = statusForEvent("email.delivered")!;
    expect(shouldApply("sent", s)).toBe(true);
    expect(shouldApply(s, s)).toBe(false);
  });

  it("lets a bounce win over delivered", () => {
    expect(shouldApply("delivered", statusForEvent("email.bounced")!)).toBe(true);
  });

  it("ignores opened and clicked", () => {
    expect(statusForEvent("email.opened")).toBeNull();
    expect(statusForEvent("email.clicked")).toBeNull();
  });

  it("ignores unknown event types", () => {
    expect(statusForEvent("email.something_new")).toBeNull();
    expect(statusForEvent("toString")).toBeNull();
  });
});
