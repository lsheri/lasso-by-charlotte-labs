import { beforeEach, describe, expect, it, vi } from "vitest";

const recordEvent = vi.fn(async () => undefined);
const logEvent = vi.fn();
let rpcAnswer: { data: unknown; error: unknown } = { data: "changed", error: null };

vi.mock("@tanstack/react-start", () => {
  const chain = () => {
    const builder: Record<string, unknown> = {};
    builder.middleware = () => builder;
    builder.inputValidator = (validate: (input: unknown) => unknown) => {
      builder.handler = (fn: (args: unknown) => unknown) =>
        (args: { data: unknown; context: unknown }) => fn({ data: validate(args.data), context: args.context });
      return builder;
    };
    return builder;
  };
  return { createServerFn: chain };
});
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/profile-resolve", () => ({
  resolveProfile: vi.fn(async () => ({ id: "p-me", org_id: "org-1" })),
}));
vi.mock("@/lib/telemetry.server", () => ({ recordEvent }));
vi.mock("@/lib/telemetry", () => ({ logEvent }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async () => rpcAnswer),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { org_id: "org-1" } }) }) }) }),
  },
}));

import { setPersonConversationsFn } from "@/lib/engagement-access.functions";
import { setBoardConversationAccess } from "@/lib/partner-share";

const db = { rpc: vi.fn(async () => rpcAnswer) };
function callPerson() {
  return (setPersonConversationsFn as unknown as (a: unknown) => Promise<unknown>)({
    data: { engagement_id: "e-1", person_id: "p-on", conversations: "full" },
    context: { supabase: db, userId: "u-1" },
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
