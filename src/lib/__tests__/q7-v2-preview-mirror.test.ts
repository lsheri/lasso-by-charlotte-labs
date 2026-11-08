import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));

import { shouldMirrorV2 } from "@/lib/telemetry-v2.server";

describe("Q7 v2 mirror: preview leaves labelled, QA never does", () => {
  it("production and preview question.asked both mirror", () => {
    expect(shouldMirrorV2("production", "question.asked")).toBe(true);
    expect(shouldMirrorV2("preview", "question.asked")).toBe(true);
  });
  it("qa, local, staging, test and unknown never mirror", () => {
    for (const env of ["qa", "local", "staging", "test", "unknown"]) {
      expect(shouldMirrorV2(env, "question.asked"), env).toBe(false);
    }
  });
  it("an event a v1 call site already mirrors never mirrors twice, in any environment", () => {
    for (const env of ["production", "preview"]) {
      expect(shouldMirrorV2(env, "conversation.pushed"), env).toBe(false);
      expect(shouldMirrorV2(env, "analysis.started"), env).toBe(false);
    }
  });
});
