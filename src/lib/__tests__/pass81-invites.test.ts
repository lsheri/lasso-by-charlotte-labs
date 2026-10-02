import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  INVITE_ADMIN_ONLY_LINE,
  INVITE_BLOCKED_STATES,
  INVITE_RESEND_ADMIN_ONLY_LINE,
  type CreateInviteResult,
} from "@/lib/invites-shared";

const SRC = join(process.cwd(), "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

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
  // Removed: "keeps the engagement chip and its honest line admin only". The
  // chip was taken off the engagement page on purpose on 09-14. The part that
  // matters, the server gate, is covered by pass143-invite-signup, "keeps
  // invite creation admin only in the server function", and by the refusal
  // record above.



  it("hides resend from leads and keeps copy link plus withdraw", () => {
    const page = read("pages/MembersPage.tsx");
    expect(page).toContain("canManageInvites");
    expect(page).toContain("INVITE_RESEND_ADMIN_ONLY_LINE");
    expect(INVITE_RESEND_ADMIN_ONLY_LINE).toBe("Only an admin can issue a new link.");
    const resendIndex = page.indexOf("onResend: () =>");
    expect(page.slice(0, resendIndex)).toContain("...(isAdmin");
  });
});

