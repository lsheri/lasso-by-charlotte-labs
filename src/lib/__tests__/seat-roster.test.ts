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
});
