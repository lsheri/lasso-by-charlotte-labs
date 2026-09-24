import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  SHARE_CLOSED_MESSAGE,
  SHARE_TOKEN_PATTERN,
  SHARE_WINDOW_HOURS,
  looksLikeShareToken,
  shareExposureSentence,
  shareLinkLive,
  shareLinkNotes,
  shareLinkUrl,
  shareTimeLeftLabel,
  shareWindowEnd,
} from "@/lib/board-share-shared";
import { generateShareToken, hashShareToken } from "@/lib/board-share.server";

const SERVER = readFileSync("src/lib/board-share.server.ts", "utf8");
const OPEN = readFileSync("src/lib/board-share-open.server.ts", "utf8");
const FUNCTIONS = readFileSync("src/lib/board-share.functions.ts", "utf8");
const VIEW = readFileSync("src/components/canvas-lab/SharedBoardView.tsx", "utf8");
const PAGE = readFileSync("src/pages/SharedBoardPage.tsx", "utf8");
const DIALOG = readFileSync("src/components/canvas-lab/ShareBoardDialog.tsx", "utf8");

describe("S1 — the token", () => {
  it("is 32 random bytes as base64url, and never the same twice", () => {
    const first = generateShareToken();
    const second = generateShareToken();
    expect(first).toMatch(SHARE_TOKEN_PATTERN);
    expect(second).toMatch(SHARE_TOKEN_PATTERN);
    expect(first).not.toBe(second);
    // base64url of 32 bytes is 43 characters with no padding.
    expect(first).toHaveLength(43);
    expect(first).not.toContain("=");
  });

  it("only its hash is ever written, and the hash does not give the token back", async () => {
    const token = generateShareToken();
    const hash = await hashShareToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(await hashShareToken(token)).toBe(hash);
  });

  it("the raw token is never persisted anywhere", () => {
    const insert = SERVER.slice(
      SERVER.indexOf('.from("board_share_links").insert({'),
      SERVER.indexOf("if (error) return { status: \"error\" }"),
    );
    // The one row ever written carries the hash and no raw value.
    expect(insert).toContain("token_hash: await hashShareToken(token)");
    expect(insert.replace("token_hash: await hashShareToken(token)", "")).not.toContain("token");
    // No write anywhere names a token column, in either half.
    for (const source of [SERVER, OPEN]) {
      // A type annotation is fine; a column named token is not.
      expect(source).not.toMatch(/\btoken:\s(?!string)/);
      expect(source).not.toMatch(/token_raw|share_token:/);
    }
    // And the elevated half only ever hashes what it is handed.
    expect(OPEN).toContain("await sha256Hex(token)");
  });

  it("a token that is not the right shape is refused before anything is read", () => {
    expect(looksLikeShareToken(generateShareToken())).toBe(true);
    expect(looksLikeShareToken("")).toBe(false);
    expect(looksLikeShareToken("short")).toBe(false);
    expect(looksLikeShareToken(null)).toBe(false);
    expect(OPEN.indexOf("looksLikeShareToken")).toBeLessThan(OPEN.indexOf("board_share_links"));
  });
});

describe("S1 — the window", () => {
  it("is 48 hours from the moment the link is made", () => {
    const from = new Date("2026-09-21T04:00:00.000Z");
    expect(SHARE_WINDOW_HOURS).toBe(48);
    expect(shareWindowEnd(from).toISOString()).toBe("2026-09-23T04:00:00.000Z");
    expect(SERVER).toContain("Date.now() + SHARE_WINDOW_MS");
  });

  it("a link is live only while it has not been ended and has not run out", () => {
    const now = new Date("2026-09-21T04:00:00.000Z");
    const live = { expiresAt: "2026-09-22T04:00:00.000Z", revokedAt: null };
    expect(shareLinkLive(live, now)).toBe(true);
    expect(shareLinkLive({ ...live, revokedAt: "2026-09-21T03:00:00.000Z" }, now)).toBe(false);
    expect(shareLinkLive({ expiresAt: "2026-09-20T04:00:00.000Z", revokedAt: null }, now)).toBe(false);
  });

  it("the time left reads in plain words and never goes negative", () => {
    const now = new Date("2026-09-21T04:00:00.000Z");
    expect(shareTimeLeftLabel("2026-09-23T04:00:00.000Z", now)).toBe("Expires in 48 hours");
    expect(shareTimeLeftLabel("2026-09-21T04:30:00.000Z", now)).toBe("Expires in 30 minutes");
    expect(shareTimeLeftLabel("2026-09-20T04:00:00.000Z", now)).toBe("Expired");
  });
});

describe("S1 — resolving a link", () => {
  it("gives the same closed answer for a wrong, an ended and a run out link", () => {
    const closed = [...OPEN.matchAll(/return \{ status: "closed" \}/g)];
    expect(closed.length).toBeGreaterThanOrEqual(4);
    // Nothing about which of the three it was reaches the caller.
    expect(OPEN).not.toMatch(/status: "(expired|revoked|unknown)"/);
  });

  it("refuses on the three closed reasons and only notes them in coverage", () => {
    expect(OPEN).toContain('noteShareEvent("refused", null, "unknown")');
    expect(OPEN).toContain('noteShareEvent("refused", link.org_id, "revoked")');
    expect(OPEN).toContain('noteShareEvent("refused", link.org_id, "expired")');
    expect(OPEN).toContain('noteShareEvent("opened", link.org_id)');
  });

  it("the elevated path writes nothing except the open count and the time", () => {
    const writes = [...OPEN.matchAll(/\.(insert|update|upsert|delete|rpc)\(/g)].map((m) => m[1]);
    expect(writes).toEqual(["update"]);
    const update = OPEN.slice(OPEN.indexOf(".update("), OPEN.indexOf(".eq(\"id\", link.id)"));
    expect(update).toContain("opened_count");
    expect(update).toContain("last_opened_at");
    expect(update).not.toContain("revoked_at");
  });

  it("the elevated path reaches only the board's own records", () => {
    const tables = [...new Set([...OPEN.matchAll(/\.from\("([a-z_]+)"\)/g)].map((m) => m[1]))].sort();
    // S3a: the live board's own inputs, so tasks and the engagement brief join.
    expect(tables).toEqual([
      "board_share_links",
      "decisions",
      "document_versions",
      "engagements",
      "tasks",
      "turns",
      "workboard_frames",
      "workboard_links",
      "workboard_nodes",
      "workboards",
    ]);
  });

  it("nothing else in the product calls the elevated path", () => {
    const callers = [...FUNCTIONS.matchAll(/board-share-open\.server/g)];
    expect(callers).toHaveLength(1);
  });
});

describe("S1 — who may make and end a link", () => {
  it("only a non coach member of that board's engagement may make one", () => {
    expect(SERVER).toContain("await isEngagementEditor(db, engagementId, profile.id)");
    expect(SERVER.indexOf("isEngagementEditor")).toBeLessThan(SERVER.indexOf("generateShareToken()"));
    // The member path never borrows elevated rights.
    expect(SERVER).not.toContain("client.server");
    expect(FUNCTIONS).not.toContain("client.server");
  });

  it("ending a link takes effect on the very next request", () => {
    // It writes the end time on the row the resolve path reads first.
    expect(SERVER).toContain('.is("revoked_at", null)');
    expect(OPEN.indexOf("link.revoked_at")).toBeLessThan(OPEN.indexOf("readBoard"));
  });

  it("what a person reads back about a link never carries the hash", () => {
    const select = SERVER.slice(SERVER.indexOf("listShareLinks"), SERVER.indexOf("expireShareLink"));
    expect(select).not.toContain("token_hash");
  });
});

describe("S1 — the honest sentence", () => {
  it("says what leaves, to whom and for how long, before the link is made", () => {
    const sentence = shareExposureSentence(false);
    expect(sentence).toContain("everything on this board");
    expect(sentence).toContain("AI conversations behind the cards");
    expect(sentence.startsWith("Anyone with this link")).toBe(true);
    expect(sentence).toContain("48 hours");
    // It sits where the person reads it before choosing, above the control.
    expect(DIALOG.indexOf("shareExposureSentence")).toBeLessThan(DIALOG.indexOf("Make a link"));
  });

  it("says so on the same sentence when the board holds somebody else's work", () => {
    expect(shareExposureSentence(true)).toContain("work owned by other people");
    expect(shareExposureSentence(false)).not.toContain("work owned by other people");
    // It says it, it does not block it.
    expect(DIALOG).not.toContain("disabled={holdsOthersWork");
  });

  it("carries the two things that otherwise surprise someone", () => {
    const [ending, changing] = shareLinkNotes();
    expect(ending).toContain("expire this link yourself");
    expect(changing).toContain("as it is then");
  });

  it("everything a person reads says the link expires, and carries no em dash", () => {
    const copy = [
      shareExposureSentence(true),
      ...shareLinkNotes(),
      SHARE_CLOSED_MESSAGE,
      shareTimeLeftLabel("2026-09-23T04:00:00.000Z", new Date("2026-09-21T04:00:00.000Z")),
    ];
    for (const line of copy) {
      expect(line).not.toMatch(/—/);
      expect(line.toLowerCase()).not.toMatch(/revoke/);
    }
    expect(DIALOG).not.toMatch(/>\s*[^<]*[Rr]evoke[^<]*</);
  });

  it("the link is shown once and nothing keeps it", () => {
    expect(DIALOG).toContain("This is the only time it is shown.");
    expect(DIALOG).not.toMatch(/localStorage|sessionStorage/);
  });
});

describe("S1 — the read only view", () => {
  it("has no way to write, and no way off the board", () => {
    for (const source of [VIEW, PAGE]) {
      expect(source).not.toMatch(/mutateCanvasLabBoardFn|useMutation|createServerFn/);
      expect(source).not.toMatch(/onDrop|contentEditable/);
      expect(source).not.toMatch(/<Link\b|useNavigate|AppSidebar/);
    }
    expect(PAGE).not.toMatch(/onPointerDown|onDragStart/);
    // S3a: the live components are reused, and every writing handler is a no-op.
    expect(VIEW).not.toMatch(/onDragStart=\{(?!noop\})/);
    expect(VIEW).not.toMatch(/onPointerDown=\{(?!noop\}|onPointerDown\})/);
    expect(VIEW).not.toMatch(/useServerFn/);
    expect(VIEW).toContain("fitWorkboardViewport");
    expect(VIEW).toContain("applyDurableBoard");
    expect(VIEW).not.toMatch(/mutateCanvasLabBoardFn|saveCanvasLab|deleteCanvasLab/);
  });

  it("the page revalidates rather than trusting what it loaded with", () => {
    expect(PAGE).toContain("refetchInterval: REVALIDATE_MS");
    expect(PAGE).toContain("refetchOnWindowFocus: true");
    expect(PAGE).toContain("staleTime: 0");
    // And it comes back by itself at the moment the window ends.
    expect(PAGE).toContain("new Date(expiresAt).getTime() - Date.now()");
  });

  it("a closed link says one plain thing and nothing about why", () => {
    expect(SHARE_CLOSED_MESSAGE).toBe("This link has expired.");
    expect(PAGE).toContain("SHARE_CLOSED_MESSAGE");
    expect(PAGE).not.toMatch(/expired link|revoked|wrong token/i);
  });

  it("shows everything on the board, transcripts included", () => {
    expect(VIEW).toContain("board.turns");
    expect(OPEN).toContain('.from("turns")');
  });
});

describe("S1 — coverage", () => {
  it("carries the two closed dims and nothing about the viewer", () => {
    // The elevated half builds its dims once, from the two closed words only.
    expect(OPEN).toContain("const dims = reason ? { action, reason } : { action };");
    const reasons = [...new Set([...OPEN.matchAll(/"(expired|revoked|unknown)"/g)].map((m) => m[1]))];
    expect(reasons.sort()).toEqual(["expired", "revoked", "unknown"]);
    expect(OPEN).not.toMatch(/dims: \{[^}]*(_id|title|token|email)/);
    expect(FUNCTIONS).toContain('dims: { action: "created" }');
    expect(FUNCTIONS).toContain('dims: { action: "revoked" }');
  });

  it("goes through the one recording path under its registered name", () => {
    const registry = readFileSync("src/lib/telemetry-shared.ts", "utf8");
    expect(registry).toContain('| "board.share_link"');
    expect(OPEN).toContain('eventType: "board.share_link"');
    expect(FUNCTIONS).toContain('eventType: "board.share_link"');
    expect(OPEN).toContain('await import("./telemetry.server")');
  });
});
