import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => ({ calls: [] as { template: string; variables: Record<string, unknown> }[] }));
vi.mock("@/lib/invites.server", async (orig) => {
  const actual = await orig<typeof import("@/lib/invites.server")>();
  return {
    ...actual,
    resendApiKey: () => "k",
    sendResendTemplate: vi.fn(async (_k: string, mail: { template: string; variables: Record<string, unknown> }) => {
      sent.calls.push(mail);
      return { ok: true, id: "x" };
    }),
  };
});
vi.mock("@/integrations/supabase/client.server", () => {
  const chain = (row: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is"]) c[m] = () => c;
    c["maybeSingle"] = async () => ({ data: row });
    return c;
  };
  return {
    supabaseAdmin: {
      from: (t: string) =>
        t === "board_invites"
          ? chain({ id: "i", code: "C", email: "jo@x.com", level: "review", conversations: "summaries", engagement_id: "e", invited_by: "p" })
          : t === "engagements"
            ? chain({ title: "<b>Board</b>" })
            : chain({ display_name: "<b>Ana</b>" }),
    },
  };
});

import { BOARD_SIGNUP_COPY, maskEmail } from "@/lib/board-invites-shared";
import { buildAuthEmails } from "@/routes/api/public/auth-email-hook";
import { sendInviteEmail } from "@/lib/invites.server";
import { buildVariables } from "@/lib/email-queue.server";
import { sendBoardInviteEmail } from "@/lib/board-invite-email.server";
import { safeNext } from "@/lib/password-reset";
import { AUTH_COPY } from "@/lib/auth-copy";

beforeEach(() => {
  sent.calls = [];
});

describe("AU-1 audit fixes", () => {
  it("B1: the mismatch refusal never reveals the full address", () => {
    const line = BOARD_SIGNUP_COPY.mismatch(maskEmail("jordan@acme.com")!);
    expect(line).toBe("This invite was sent to j***@acme.com. Use that address.");
    expect(line).not.toContain("jordan");
    expect(readFileSync("src/lib/board-invites.functions.ts", "utf8")).toContain("email_hint: maskEmail(row.email)");
  });

  it("W1: the hook passes USER_EMAIL, escaped", () => {
    const out = buildAuthEmails({ user: { email: "a<b>@x.com" }, email_data: { email_action_type: "signup", token_hash: "h" } });
    expect(out[0]!.variables["USER_EMAIL"]).toBe("a&lt;b&gt;@x.com");
  });

  it("W2: <b> arrives escaped in all three senders", async () => {
    const bodies: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: { body: string }) => {
      bodies.push(init.body);
      return new Response(JSON.stringify({ id: "x" }), { status: 200 });
    }));
    process.env["RESEND_API_KEY"] = "k";
    await sendInviteEmail({ to: "t@x.com", inviterName: "<b>Ana</b>", code: "C", orgName: "<b>Org</b>", role: "member", orgType: "business" });
    vi.unstubAllGlobals();
    expect(bodies.join("")).toContain("&lt;b&gt;Ana&lt;/b&gt;");
    expect(bodies.join("")).not.toContain("<b>Ana");
    expect(buildVariables({ WORKSPACE_NAME: "<b>W</b>", CODE: "C" })["WORKSPACE_NAME"]).toBe("&lt;b&gt;W&lt;/b&gt;");
    await sendBoardInviteEmail("i");
    const board = sent.calls.find((c) => c.template === "board-invite")!;
    expect(board.variables["BOARD_NAME"]).toBe("&lt;b&gt;Board&lt;/b&gt;");
  });

  it("W2: num() omits missing keys and leaves the URL alone", () => {
    const v = buildVariables({ CODE: "ABC", SEATS: 3 });
    expect(v["SEATS"]).toBe(3);
    expect("EXPIRES_DAYS" in v).toBe(false);
    expect(String(v["JOIN_URL"])).toContain("ABC");
  });

  it("W3: Open the board uses engagement_id from the claim", () => {
    const page = readFileSync("src/routes/board-invite.tsx", "utf8");
    const fn = page.slice(page.indexOf("async function openAccepted"), page.indexOf("async function signOut"));
    expect(fn).toContain("result.engagementId");
    expect(fn).toContain('"/engagements/$id/canvas-lab"');
    expect(fn).toContain("setActiveProfileId");
  });

  it("W4: safeNext keeps /board-invite?", () => {
    expect(safeNext("/board-invite?code=AB")).toBe("/board-invite?code=AB");
  });

  it("W6: the invite button text", () => {
    expect(AUTH_COPY.continueInvite).toBe("Continue to the invite");
    expect(readFileSync("src/routes/auth.tsx", "utf8")).toContain("inviteCode && !key ? AUTH_COPY.continueInvite");
  });

  it("W13: the invalid-key message and the heading fix", () => {
    expect(AUTH_COPY.keyInvalid).toBe("This key link is not valid. Ask whoever sent it for a new one.");
    expect(AUTH_COPY.signupHeading).toBe("Create your Lasso account");
    const auth = readFileSync("src/routes/auth.tsx", "utf8");
    expect(auth).not.toMatch(/: "Create account"\}\{" "\}/);
  });
});

import { checkKeyPublic, GENERIC_ANSWER } from "@/lib/activation-key-public.server";

describe("AU-1b public key check", () => {
  const good = { expires_at: null, revoked_at: null, max_uses: 5, uses: 1, institutions: { name: "Harbor" } };

  it("returns only the two fields", async () => {
    const answer = await checkKeyPublic("lso-ok", "1.1.1.1", async () => good, () => true);
    expect(Object.keys(answer).sort()).toEqual(["institution_name", "valid"]);
    expect(answer).toEqual({ valid: true, institution_name: "Harbor" });
  });

  it("an unknown key gives valid false, and the code is normalised", async () => {
    const seen: string[] = [];
    const answer = await checkKeyPublic(" lso-nope ", "1.1.1.1", async (c) => { seen.push(c); return null; }, () => true);
    expect(answer).toEqual({ valid: false, institution_name: null });
    expect(seen).toEqual(["LSO-NOPE"]);
  });

  it("over the limit returns the generic answer without a lookup", async () => {
    let looked = false;
    const answer = await checkKeyPublic("x", "1.1.1.1", async () => { looked = true; return null; }, () => false);
    expect(answer).toEqual(GENERIC_ANSWER);
    expect(looked).toBe(false);
  });
});
