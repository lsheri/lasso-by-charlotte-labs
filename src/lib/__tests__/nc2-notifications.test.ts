import { describe, expect, it } from "vitest";

import { boardAccessLine, buildBoardInviteUrl, escapeHtml } from "@/lib/board-invite-email.server";
import { buildJoinUrl } from "@/lib/join-link";
import { badgeCount, notificationSentence, NOTIFICATION_COPY } from "@/lib/notifications-shared";
import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";

describe("nc2 access lines", () => {
  it("returns the four exact lines", () => {
    expect(boardAccessLine("review", "summaries")).toBe("You can view the cards and their summaries.");
    expect(boardAccessLine("review", "full")).toBe(
      "You can view the cards, their summaries and the full AI conversations.",
    );
    expect(boardAccessLine("work", "summaries")).toBe("You can add and edit cards, and see their summaries.");
    expect(boardAccessLine("work", "full")).toBe(
      "You can add and edit cards, and see the full AI conversations.",
    );
  });
});

describe("nc2 escaping and url", () => {
  it("escapes & < > \" '", () => {
    expect(escapeHtml(`<b>&"'`)).toBe("&lt;b&gt;&amp;&quot;&#39;");
  });
  it("builds the query form on the canonical origin", () => {
    const url = buildBoardInviteUrl("AB 12");
    expect(url).toBe("https://lasso.charlotte-labs.com/board-invite?code=AB+12");
    expect(new URL(url).origin).toBe(new URL(buildJoinUrl("x")).origin);
  });
});

describe("nc2 badge", () => {
  it("counts open Needs you rows only and caps at 9+", () => {
    expect(badgeCount([])).toBe("");
    expect(
      badgeCount([
        { section: "needs_you", acted_at: null },
        { section: "needs_you", acted_at: "2026-10-01" },
        { section: "updates", acted_at: null },
      ]),
    ).toBe("1");
    expect(badgeCount(Array.from({ length: 12 }, () => ({ section: "needs_you", acted_at: null })))).toBe("9+");
  });
});

describe("nc2 sentences", () => {
  const s = (kind: string, payload: Record<string, unknown>) => notificationSentence({ kind, payload });
  it("renders every kind", () => {
    expect(s("invite_needs_approval", { by: "Ana", email: "a@b.co", board: "Pricing" })).toBe(
      "Ana wants to invite a@b.co to Pricing.",
    );
    expect(s("invite_decided", { email: "a@b.co", approved: true })).toBe("Your invite to a@b.co was approved.");
    expect(s("invite_decided", { email: "a@b.co", approved: false })).toBe(
      "Your invite to a@b.co was not approved.",
    );
    expect(s("invite_accepted", { board: "Pricing" })).toBe("Pricing: your invite was accepted.");
    expect(s("share_received", { board: "Pricing" })).toBe("Pricing was shared with you.");
    expect(s("seat_over_count", { seats: 5, filled: 7 })).toBe(
      "7 people on 5 seats. Add seats in Settings when you are ready.",
    );
    expect(s("board_activity", { board: "Pricing", count: 3 })).toBe("Pricing: 3 new cards.");
  });
  it("keeps copy free of em dashes and banned words", () => {
    const all = Object.values(NOTIFICATION_COPY).join(" ");
    expect(all).not.toContain("\u2014");
    expect(all).not.toMatch(/\b(track|monitor|audit|score)/i);
  });
  it("allowlists the two events with closed dims", () => {
    expect(EVENT_DIM_KEYS["notification.opened"]).toEqual(["needs_you"]);
    expect(EVENT_DIM_KEYS["notification.acted"]).toEqual(["action", "kind"]);
  });
});
