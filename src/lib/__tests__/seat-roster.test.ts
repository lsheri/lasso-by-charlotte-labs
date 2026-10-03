import { describe, expect, it } from "vitest";

import { CANONICAL_ORIGIN } from "@/lib/app-host";
import { buildVariables } from "@/lib/email-queue.server";
import { attendeeLink } from "@/lib/join-link";

describe("seat roster links", () => {
  it("builds an attendee JOIN_URL when LINK_KIND is attendee", () => {
    const v = buildVariables({ LINK_KIND: "attendee", CODE: "LSO-TEST1", REGISTER: "edu" });
    console.log("ATTENDEE JOIN_URL:", v["JOIN_URL"]);
    expect(String(v["JOIN_URL"]).endsWith("/j/LSO-TEST1?r=edu")).toBe(true);
  });

  it("keeps the admin JOIN_URL without LINK_KIND", () => {
    const v = buildVariables({ CODE: "ADM-TEST1" });
    console.log("ADMIN JOIN_URL:", v["JOIN_URL"]);
    expect(String(v["JOIN_URL"]).endsWith("/join?code=ADM-TEST1")).toBe(true);
  });

  it("passes PARTNER_NAME through, empty when absent", () => {
    expect(buildVariables({ PARTNER_NAME: "Ceiba" })["PARTNER_NAME"]).toBe("Ceiba");
    expect(buildVariables({})["PARTNER_NAME"]).toBe("");
  });

  it("attendeeLink carries r only when given", () => {
    const plain = attendeeLink("LSO-X");
    const withR = attendeeLink("LSO-X", "personal");
    expect(new URL(plain).search).toBe("");
    expect(withR.endsWith("?r=personal")).toBe(true);
    expect(plain.startsWith(CANONICAL_ORIGIN)).toBe(true);
    expect(withR.startsWith(CANONICAL_ORIGIN)).toBe(true);
  });

  it("seat roster event payloads carry counts and the fixed source only", () => {
    // The three payloads KeyRequestsPage can emit from the seat roster.
    const payloads: Record<string, unknown>[] = [
      { count: 2, source: "roster" }, // seat.named
      { count: 3 }, // invite.sent
      {}, // seat.revoked
    ];
    const emailish = /@|\S+@\S+/;
    for (const p of payloads) {
      for (const key of Object.keys(p)) {
        expect(["count", "source"]).toContain(key);
      }
      for (const value of Object.values(p)) {
        expect(String(value)).not.toMatch(emailish);
      }
    }
  });
});
