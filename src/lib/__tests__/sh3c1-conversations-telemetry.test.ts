import { beforeEach, describe, expect, it, vi } from "vitest";

const recordEvent = vi.fn(async () => undefined);
const logEvent = vi.fn();
let rpcAnswer: { data: unknown; error: unknown } = { data: "changed", error: null };

vi.mock("@/lib/telemetry.server", () => ({ recordEvent }));
vi.mock("@/lib/telemetry", () => ({ logEvent }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async () => rpcAnswer),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { org_id: "org-1" } }) }) }) }),
  },
}));

import { recordConversationsChange, setPersonConversations } from "@/lib/engagement-access.server";
import { setBoardConversationAccess } from "@/lib/partner-share";

const db = { rpc: vi.fn(async () => rpcAnswer) };
async function callPerson() {
  const answer = await setPersonConversations(db as never, "e-1", "p-on", "full");
  await recordConversationsChange(db as never, {
    answer,
    conversations: "full",
    orgId: "org-1",
    userId: "u-1",
    profileId: "p-me",
  });
}

beforeEach(() => {
  recordEvent.mockClear();
  logEvent.mockClear();
});

describe("SH-3c-1 member switch", () => {
  it("emits access_changed with conversations and target member on changed", async () => {
    rpcAnswer = { data: "changed", error: null };
    await callPerson();
    expect(recordEvent).toHaveBeenCalledTimes(1);
    expect((recordEvent.mock.calls[0] as unknown[])[1]).toMatchObject({
      eventType: "engagement.access_changed",
      dims: { conversations: "full", result: "changed", target: "member" },
    });
  });
  it("emits nothing on unchanged or refused", async () => {
    rpcAnswer = { data: "unchanged", error: null };
    await callPerson();
    rpcAnswer = { data: null, error: { message: "nope" } };
    await callPerson();
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

describe("SH-3c-1 partner switch", () => {
  it("emits access_changed with target partner on changed", async () => {
    rpcAnswer = { data: "changed", error: null };
    await setBoardConversationAccess("link-1", "e-1", "full");
    expect(logEvent).toHaveBeenCalledWith("engagement.access_changed", "org-1", {
      conversations: "full",
      result: "changed",
      target: "partner",
    });
  });
  it("emits nothing on unchanged", async () => {
    rpcAnswer = { data: "unchanged", error: null };
    await setBoardConversationAccess("link-1", "e-1", "summaries");
    expect(logEvent).not.toHaveBeenCalled();
  });
});
