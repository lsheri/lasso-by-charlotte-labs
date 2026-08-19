import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  INVITE_ADMIN_ONLY_LINE,
  INVITE_BLOCKED_STATES,
  INVITE_RESEND_ADMIN_ONLY_LINE,
  type CreateInviteResult,
} from "@/lib/invites-shared";
import { stepsFor } from "@/components/onboarding/checklist/steps";
import type { OnboardingProgress } from "@/lib/onboarding-progress.functions";

const SRC = join(process.cwd(), "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

function progress(over: Partial<OnboardingProgress> = {}): OnboardingProgress {
  return {
    role_variant: "worker",
    is_admin: false,
    can_invite: false,
    quick_folder: false,
    counts: {
      capture: 0,
      work_items: 0,
      mapped: 0,
      analyses: 0,
      invites: 0,
      invites_by_me: 0,
      shared_engagements: 0,
      shared_by_me: 0,
      firm_checks: 0,
      one_on_one: 0,
      members: 0,
    },
    naming_set: false,
    ...over,
  };
}

describe("invite refusal shape", () => {
  it("types a refusal without leaking a database message", () => {
    const refused: CreateInviteResult = {
      ok: false,
      reason: "not_permitted",
      message: INVITE_ADMIN_ONLY_LINE,
    };
    expect(refused.ok).toBe(false);
    expect(refused.message).toContain("workspace admin");
    expect(refused.message).not.toContain("permission denied");
  });

  it("whitelists not_permitted for the content free blocked record", () => {
    expect(INVITE_BLOCKED_STATES).toContain("not_permitted");
    expect(INVITE_BLOCKED_STATES).toContain("already_member");
  });

  it("mints through the server function, never a browser rpc", () => {
    const dialog = read("components/invites/InviteDialog.tsx");
    expect(dialog).not.toContain('supabase.rpc("make_invite"');
    expect(dialog).toContain("createInvite as createInviteFn");
    expect(dialog).toContain('profile?.role === "admin"');
  });

  it("records the refusal as invite.blocked with a content free dim", () => {
    const fn = read("lib/invites.functions.ts");
    expect(fn).toContain('eventType: "invite.blocked"');
    expect(fn).toContain('dims: { state: "not_permitted" }');
  });
});

describe("invite trigger gates", () => {
  it("keeps the engagement chip and its honest line admin only", () => {
    const page = read("pages/EngagementPage.tsx");
    expect(page).not.toContain('profile?.role === "lead"');
    expect(page).toContain("INVITE_ADMIN_ONLY_LINE");
  });

  it("hides resend from leads and keeps copy link plus withdraw", () => {
    const page = read("pages/MembersPage.tsx");
    expect(page).toContain("canManageInvites");
    expect(page).toContain(INVITE_RESEND_ADMIN_ONLY_LINE);
    const resendIndex = page.indexOf("onResend: () =>");
    expect(page.slice(0, resendIndex)).toContain("...(isAdmin");
  });
});

describe("can_invite step gating", () => {
  it("gives a worker without invite rights a share only step", () => {
    const steps = stepsFor(progress());
    const step = steps.find((s) => s.id === "invite-coach");
    expect(step).toBeDefined();
    expect(step?.hint).not.toContain("invite a new one");
    expect(step?.to).toBe("/engagements");
    expect(steps.some((s) => s.id === "invite-team")).toBe(false);
  });

  it("completes the share step from a share, not an invite", () => {
    const steps = stepsFor(progress({ counts: { ...progress().counts, shared_by_me: 2 } }));
    const step = steps.find((s) => s.id === "invite-coach");
    expect(step?.done(progress({ counts: { ...progress().counts, shared_by_me: 2 } }))).toBe(
      "2 engagements shared",
    );
  });

  it("keeps naming for a lead but drops the invite team step", () => {
    const steps = stepsFor(progress({ is_admin: true, can_invite: false }));
    expect(steps.some((s) => s.id === "naming")).toBe(true);
    expect(steps.some((s) => s.id === "invite-team")).toBe(false);
  });

  it("gives an admin both invite steps in their full form", () => {
    const steps = stepsFor(progress({ is_admin: true, can_invite: true }));
    expect(steps.some((s) => s.id === "invite-team")).toBe(true);
    expect(steps.find((s) => s.id === "invite-coach")?.to).toBe("/members");
  });
});
