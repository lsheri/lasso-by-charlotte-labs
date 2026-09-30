import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@react-email/render";
import { Webhook } from "standardwebhooks";

vi.mock("@lovable.dev/email-js", () => ({ sendLovableEmail: vi.fn(async () => ({})) }));

import { sendLovableEmail } from "@lovable.dev/email-js";
import {
  AUTH_EMAIL_SUBJECTS,
  buildAuthEmails,
  handleAuthEmailHook,
  type AuthEmailType,
} from "@/routes/api/public/auth-email-hook";
import { sendInviteEmail } from "@/lib/invites.server";
import { sendPilotNotification } from "@/lib/pilot-request.functions";

const RAW = Buffer.from("unit-e1-test-secret-0123456789ab").toString("base64");
const SECRET = `v1,whsec_${RAW}`;

function payload(type: AuthEmailType) {
  return {
    user: { email: "old@x.com", new_email: type === "email_change" ? "new@x.com" : null },
    email_data: { token: "123456", token_hash: "hash", redirect_to: "https://lasso.charlotte-labs.com", email_action_type: type },
  };
}

function signedRequest(body: string, secret = RAW) {
  const id = "msg_1";
  const ts = new Date();
  const sig = new Webhook(secret).sign(id, ts, body);
  return new Request("http://x/api/public/auth-email-hook", {
    method: "POST",
    body,
    headers: { "webhook-id": id, "webhook-timestamp": String(Math.floor(ts.getTime() / 1000)), "webhook-signature": sig },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(sendLovableEmail).mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("auth email hook", () => {
  it("500s without a secret and never sends", async () => {
    vi.stubEnv("SEND_EMAIL_HOOK_SECRET", "");
    const res = await handleAuthEmailHook(signedRequest(JSON.stringify(payload("signup"))));
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a missing signature", async () => {
    vi.stubEnv("SEND_EMAIL_HOOK_SECRET", SECRET);
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const res = await handleAuthEmailHook(new Request("http://x", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a bad signature", async () => {
    vi.stubEnv("SEND_EMAIL_HOOK_SECRET", SECRET);
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const other = Buffer.from("a-different-secret-0123456789abcd").toString("base64");
    const res = await handleAuthEmailHook(signedRequest(JSON.stringify(payload("signup")), other));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a verified request through Resend with the default from", async () => {
    vi.stubEnv("SEND_EMAIL_HOOK_SECRET", SECRET);
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("RESEND_FROM", "");
    const res = await handleAuthEmailHook(signedRequest(JSON.stringify(payload("recovery"))));
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    const sent = JSON.parse(init.body);
    expect(sent.from).toBe("Lasso <noreply@lasso.charlotte-labs.com>");
    expect(sent.subject).toBe("Reset your password");
    expect(sent.to).toEqual(["old@x.com"]);
  });

  const expected: Record<AuthEmailType, [string, string]> = {
    signup: ["Confirm your email", "Confirm your email"],
    invite: ["You are invited", "Accept your invite"],
    magiclink: ["Your sign in link", "Sign in"],
    recovery: ["Reset your password", "Choose a new password"],
    email_change: ["Confirm your new email", "Confirm the change"],
    reauthentication: ["Your verification code", "123456"],
  };
  for (const type of Object.keys(expected) as AuthEmailType[]) {
    it(`${type} renders its template and subject`, async () => {
      const mails = buildAuthEmails(payload(type));
      expect(mails.length).toBeGreaterThan(0);
      expect(mails[0]!.subject).toBe(AUTH_EMAIL_SUBJECTS[type]);
      expect(mails[0]!.subject).toBe(expected[type][0]);
      const html = await render(mails[0]!.element);
      expect(html).toContain(expected[type][1]);
    });
  }
});

describe("invite email transport", () => {
  const args = { to: "p@x.com", inviterName: "Dana", code: "a", orgName: "Acme" };

  it("sends the published template by alias when RESEND_API_KEY is set", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const result = await sendInviteEmail(args);
    expect(result.sent).toBe(true);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.resend.com/emails");
    const sent = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(sent.template.id).toBe("invite-member");
    expect(sent.template.variables.ACCEPT_URL).toBe("https://lasso.charlotte-labs.com/join?code=a");
    expect("reply_to" in sent).toBe(false);
    expect(sendLovableEmail).not.toHaveBeenCalled();
  });

  it("reports not configured when RESEND_API_KEY is unset", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const result = await sendInviteEmail(args);
    expect(result).toEqual({ sent: false, reason: "not_configured", message: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("pilot-request notification", () => {
  const request = {
    id: "1",
    created_at: "2026-09-20T05:32:00Z",
    name: "Alex Morgan",
    firm: "Northwind Advisory",
    email: "alex@example.com",
    team_size: "6-15" as const,
    note: "",
  };

  it("sends pilot-request-notify with SUBMITTER_EMAIL and the team size label", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    expect(await sendPilotNotification(request)).toBe(true);
    const sent = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(sent.to).toEqual(["liam@charlotte-labs.com"]);
    expect(sent.reply_to).toBe("alex@example.com");
    expect(sent.template.id).toBe("pilot-request-notify");
    const v = sent.template.variables;
    expect(v.SUBMITTER_EMAIL).toBe("alex@example.com");
    expect(v.TEAM_SIZE).toBe("6 to 15");
    for (const reserved of ["EMAIL", "FIRST_NAME", "LAST_NAME", "RESEND_UNSUBSCRIBE_URL"]) {
      expect(reserved in v).toBe(false);
    }
    expect(Object.keys(v).sort()).toEqual(["CREATED_AT", "FIRM", "NAME", "NOTE", "SUBMITTER_EMAIL", "TEAM_SIZE"]);
  });

  it("does not send without RESEND_API_KEY", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await sendPilotNotification(request)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
