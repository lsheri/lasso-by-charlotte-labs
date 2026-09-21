// @vitest-environment jsdom
/**
 * S3 — who may write a note is decided by the engagement relationship, the
 * same one the insert policy checks, never by the workspace wide role.
 * Behaviour only: no wording, no class names.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const markRead = vi.hoisted(() => vi.fn(() => Promise.resolve()));

// The engagement relationship under test. myRole is the signed in person's
// member_role on the engagement; subjectRole is the subject's.
let myRole: string | null | undefined;
let subjectRole: string | null;

vi.mock("@/hooks/use-member-role", () => ({
  useMyMemberRole: () => ({ data: myRole }),
}));

// Workspace role is deliberately NOT coach: the whole point is that the
// workspace role no longer decides.
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({
    data: { id: "p-reviewer", org_id: "o1", role: "em", org_type: null, display_name: "Rey" },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/telemetry", () => ({ logEvent: () => undefined }));

let packet: unknown;
vi.mock("@/hooks/use-coaching", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>;
  return { ...orig, usePacket: () => ({ data: packet, isLoading: false, error: null }) };
});

vi.mock("@/hooks/use-coach-note-thread", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>;
  return {
    ...orig,
    useNoteReplies: () => ({ data: [] }),
    useSendNoteReply: () => ({ mutateAsync: async () => undefined, isPending: false }),
    markNoteRead: markRead,
  };
});

vi.mock("@/hooks/use-firm-checks", () => ({
  useFirmChecks: () => ({ data: [] }),
  useWriteFirmCheck: () => ({
    add: { mutateAsync: async () => undefined, isPending: false },
    deactivate: { mutateAsync: async () => undefined },
  }),
  firmCheckAppliesTo: () => "",
}));

vi.mock("@/components/coaching/CoachChat", () => ({ CoachChat: () => null }));
vi.mock("@/components/coaching/CoachOutcomeCard", () => ({ CoachOutcomeCard: () => null }));
vi.mock("@/components/coaching/NoteComposer", () => ({
  NoteComposer: () => createElement("div", { "data-testid": "note-surface" }),
}));
vi.mock("@/components/coaching/CoachNoteModal", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>;
  return orig;
});
vi.mock("@/components/peek/PeekPanel", () => ({ PeekPanel: () => null }));
vi.mock("@/components/reflect/AnalysisLens", () => ({ AnalysisLens: () => null }));
vi.mock("@/components/work/TaskWorkflow", () => ({ TaskWorkflow: () => null }));
vi.mock("@/components/work/SourceMark", () => ({ SourceMark: () => null }));

const { PacketPage } = await import("@/pages/PacketPage");
const { CoachNoteModal } = await import("@/components/coaching/CoachNoteModal");
const { FirmChecksCard } = await import("@/components/coaching/FirmChecksCard");

function makePacket() {
  return {
    engagement: {
      id: "e1",
      code: "ENG-1",
      title: "An engagement",
      client_label: null,
      brief: null,
      term_label: null,
      clients: null,
    },
    subject: { id: "p-subject", display_name: "Sam", title_band: null },
    subjectMemberRole: subjectRole,
    tasks: [],
    decisions: [],
    notes: [],
  };
}

function withClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, node);
}

afterEach(() => {
  cleanup();
  markRead.mockClear();
});

describe("the note surface follows the engagement relationship", () => {
  it("offers the note surface to a Review person writing about a Work person, whatever the workspace role says", () => {
    myRole = "coach"; // Review on this engagement
    subjectRole = "em"; // Work on this engagement
    packet = makePacket();
    render(withClient(createElement(PacketPage, { engagementId: "e1", subjectId: "p-subject" })));
    expect(screen.queryByTestId("note-surface")).toBeTruthy();
  });

  it("offers nothing when the subject is not on the engagement", () => {
    myRole = "coach";
    subjectRole = null;
    packet = makePacket();
    render(withClient(createElement(PacketPage, { engagementId: "e1", subjectId: "p-subject" })));
    expect(screen.queryByTestId("note-surface")).toBeNull();
  });

  it("offers nothing when everyone on the board has Review, so nobody can be the subject", () => {
    myRole = "coach";
    subjectRole = "coach";
    packet = makePacket();
    render(withClient(createElement(PacketPage, { engagementId: "e1", subjectId: "p-subject" })));
    expect(screen.queryByTestId("note-surface")).toBeNull();
  });

  it("offers nothing to a Work person, even about another Work person", () => {
    myRole = "em";
    subjectRole = "em";
    packet = makePacket();
    render(withClient(createElement(PacketPage, { engagementId: "e1", subjectId: "p-subject" })));
    expect(screen.queryByTestId("note-surface")).toBeNull();
  });
});

describe("opening a note", () => {
  const note = {
    id: "n1",
    created_at: new Date().toISOString(),
    did_well: "a",
    would_try: "b",
    watch_next: "c",
    engagement_id: "e1",
    task_id: null,
    work_item_id: null,
    profiles: { display_name: "Dana" },
  };

  it("a Review reader is treated as the coach side, so no read mark is written for them", async () => {
    myRole = "coach";
    render(
      withClient(
        createElement(CoachNoteModal, { note, open: true, onOpenChange: () => undefined }),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(markRead).not.toHaveBeenCalled();
  });

  it("the subject still marks the note read", async () => {
    myRole = "em";
    render(
      withClient(
        createElement(CoachNoteModal, { note, open: true, onOpenChange: () => undefined }),
      ),
    );
    await waitFor(() => expect(markRead).toHaveBeenCalledWith("n1"));
  });

  it("no read mark is written before the relationship is known", async () => {
    myRole = undefined;
    render(
      withClient(
        createElement(CoachNoteModal, { note, open: true, onOpenChange: () => undefined }),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(markRead).not.toHaveBeenCalled();
  });
});

describe("firm checks follow the same relationship", () => {
  it("a Review person on the engagement can write a check whatever the workspace role says", () => {
    myRole = "coach";
    const { container } = render(
      createElement(FirmChecksCard, {
        orgId: "o1",
        authorProfileId: "p-reviewer",
        role: "em",
        engagementId: "e1",
      }),
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("a Work person on the engagement is not offered the writer surface", () => {
    myRole = "em";
    const { container } = render(
      createElement(FirmChecksCard, {
        orgId: "o1",
        authorProfileId: "p-reviewer",
        role: "em",
        engagementId: "e1",
      }),
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("what moved and what did not", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("the coach queue reads engagement membership, not the workspace role", () => {
    const hook = read("src/hooks/use-coaching.ts");
    expect(hook).toContain('member_role", "coach"');
    expect(hook).not.toContain('profiles.filter((p) => p.role === "coach")');
    const fn = read("src/lib/coach-subjects.functions.ts");
    expect(fn).not.toContain('profile.role === "coach"');
  });

  it("the three firm wide surfaces still read the workspace role, unchanged", () => {
    expect(read("src/components/firm/FirmArchive.tsx")).toMatch(/role === "coach"/);
    expect(read("src/components/archive/ArchivePile.tsx")).toMatch(/role === "coach"/);
    expect(read("src/hooks/use-shipped-work.ts")).toContain('profile?.role !== "coach"');
  });
});
