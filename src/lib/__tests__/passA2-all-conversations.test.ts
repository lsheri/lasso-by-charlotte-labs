import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { navGroups } from "@/components/layout/nav-config";

const page = readFileSync("src/pages/AiRecordPage.tsx", "utf8");
const asked = readFileSync("src/components/reflect/AskedSessions.tsx", "utf8");
const fab = readFileSync("src/components/reflect/AskLassoFab.tsx", "utf8");
const chatlib = readFileSync("src/lib/chat-library.functions.ts", "utf8");

describe("pass A2 · All conversations absorbs Reflect", () => {
  it("renames the two nav rows", () => {
    const labels = navGroups.flatMap((g) => g.items ?? []).map((i) => i.label);
    expect(labels).toContain("Inbox");
    expect(labels).toContain("All AI Conversations");
  });

  it("titles the page All AI Conversations", () => {
    expect(page).toContain('>All AI Conversations</h1>');
  });

  it("removes the retired Preview and Sticky controls", () => {
    expect(page).not.toContain('aria-label="How conversations are shown"');
    expect(page).not.toContain('aria-label="Preview" title="Preview"');
    expect(page).not.toContain('aria-label="Sticky" title="Sticky"');
    expect(page).not.toContain('lasso.chatlib.view');
  });

  it("moves history to a validated view and records it on the settled event", () => {
    expect(page).toContain('search.view === "asked"');
    expect(page).toContain("noteViewChanged");
  });

  it("removes source tabs and Subjects and links while keeping primary actions", () => {
    const header = page.slice(page.indexOf("<header"), page.indexOf("</header>"));
    expect(header).not.toContain('aria-label="Which conversations are shown"');
    expect(header).not.toContain("Subjects and links");
    expect(header).toContain("Add a chat");
    expect(header).toContain("Ask Lasso");
    expect(page).toContain('className="h-7 w-[200px] shrink-0');
  });

  it("stacks month sections and wraps their fixed-height cards", () => {
    expect(page).toContain('className="conversation-month-stack p-5"');
    expect(page).toContain('className="conversation-month-grid"');
    expect(page).toContain('className="h-[118px] min-w-0"');
    expect(page).not.toContain("<BoardShell");
  });

  it("adds the new values to the closed view vocabulary without removing the old ones", () => {
    expect(chatlib).toContain(
      'const CHAT_VIEWS = ["cards", "list", "preview", "sticky", "captured", "asked", "everything"] as const;',
    );
    expect(chatlib).toContain('eventType: "chatlib.view_changed"');
  });

  it("reuses the one conversation read rather than writing a second query", () => {
    expect(asked).toContain("getReflectBoot");
    expect(asked).toContain('["reflect-sessions", profile?.id]');
    expect(asked).not.toContain('from("chat_sessions").select');
  });

  it("keeps the promise on the asked rows", () => {
    expect(asked).toContain("Private to you. Your coach never sees this.");
    expect(page).toContain("Private to you. Your coach never sees this.");
  });

  it("keeps delete on the row", () => {
    expect(asked).toContain("deleteSession");
    expect(asked).toContain("Delete this session?");
  });

  it("opens the composer rather than landing on a page with no Ask surface", () => {
    expect(fab).toContain('to="/ai-record"');
    expect(fab).toContain("search={{ ask: true }}");
    expect(page).toContain("search.ask");
  });

  it("reuses the existing reader and composer", () => {
    expect(page).toContain("<ReflectPage");
    expect(page).toContain("autoStart");
  });
});
