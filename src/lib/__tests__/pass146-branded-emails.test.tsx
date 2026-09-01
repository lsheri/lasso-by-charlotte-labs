import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";

import { SignupEmail } from "@/lib/email-templates/signup";
import { InviteEmail } from "@/lib/email-templates/invite";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { EmailChangeEmail } from "@/lib/email-templates/email-change";
import { ReauthenticationEmail } from "@/lib/email-templates/reauthentication";
import { FOOTER_LINE, LASSO_MARK_URL, TITLE_STACK } from "@/lib/email-templates/notebook";
import { renderInviteEmail } from "@/lib/invite-email";

const BANNED = [
  "score",
  "monitor",
  "track",
  "surveillance",
  "oversight",
  "governance",
  "compliance",
  "integrity",
  "telemetry",
  "analytics",
];

const SITE = "Lasso";
const URL = "https://lasso.charlotte-labs.com/confirm";

const cases: Array<[string, React.ReactElement]> = [
  [
    "signup",
    <SignupEmail
      siteName={SITE}
      siteUrl="https://lasso.charlotte-labs.com"
      recipient="person@firm.com"
      confirmationUrl={URL}
    />,
  ],
  [
    "invite",
    <InviteEmail
      siteName={SITE}
      siteUrl="https://lasso.charlotte-labs.com"
      confirmationUrl={URL}
    />,
  ],
  ["magiclink", <MagicLinkEmail siteName={SITE} confirmationUrl={URL} />],
  ["recovery", <RecoveryEmail siteName={SITE} confirmationUrl={URL} />],
  [
    "email_change",
    <EmailChangeEmail
      siteName={SITE}
      oldEmail="old@firm.com"
      email="new@firm.com"
      newEmail="new@firm.com"
      confirmationUrl={URL}
    />,
  ],
  ["reauthentication", <ReauthenticationEmail token="123456" />],
];

describe("pass146 branded auth emails", () => {
  for (const [name, element] of cases) {
    it(`${name} wears the shared notebook system`, async () => {
      const html = await render(element);
      expect(html).toContain("LASSO");
      expect(html).toContain(LASSO_MARK_URL);
      expect(html).toContain("BY CHARLOTTE LABS");
      expect(html).toContain("letter-spacing:6px");
      expect(html).not.toContain("background-color:#111413");
      expect(html).toContain("#fafafa");
      expect(html).toContain(TITLE_STACK.replace(/'/g, "&#x27;"));
      expect(html).toContain(FOOTER_LINE.split(" ")[0]!);
      expect(html).toContain("lasso.charlotte-labs.com");
    });

    it(`${name} keeps the copy plain`, async () => {
      const text = (await render(element, { plainText: true })).toLowerCase();
      for (const word of BANNED) expect(text).not.toContain(word);
      expect(text).not.toContain("—");
      expect(text).not.toContain("!");
    });
  }

  it("the org invite email shares the same system", () => {
    const mail = renderInviteEmail({
      inviterName: "Dana Reed",
      orgName: "Acme Partners",
      acceptUrl: "https://lasso.charlotte-labs.com/join?code=abcd1234",
    });
    expect(mail.html).toContain(FOOTER_LINE);
    expect(mail.html).toContain(TITLE_STACK);
    expect(mail.html).toContain(LASSO_MARK_URL);
    expect(mail.html).toContain("BY CHARLOTTE LABS");
    expect(mail.html).not.toContain("background:#111413");
    expect(mail.text).not.toContain("—");
  });
});
