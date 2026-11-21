// @vitest-environment jsdom
// 21 Nov 2026, chat pill PR 4a (D-97): a proposal's Lead can be a teammate with a login. The sheet lists teammates
// first, then People we work with. Picking a teammate not on People yet links them (or adds them) before anything
// else happens; nothing is saved as the lead and nothing is sent until the usual Save or Ask.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeadSheet } from "@/components/proposals/LeadSheet";
import type { AskPreview } from "@/lib/lead-ask-shared";
import { LEAD_COPY, type DeskProposal } from "@/lib/proposal-desk-shared";
import type { RosterContact, RosterTeammate, TeammateLinkResult } from "@/lib/roster-shared";

afterEach(cleanup);

const person = (id: string, name: string, over: Partial<RosterContact> = {}): RosterContact => ({
  id,
  name,
  role: null,
  affiliation: "independent",
  firm: null,
  texts: "none",
  agreedOn: null,
  stoppedOn: null,
  confirmed: false,
  changeUntil: null,
  linkPath: `/texts?w=o&c=${id}`,
  phoneMasked: null,
  email: null,
  linkedin: null,
  needsDetails: false,
  numberDiffers: false,
  invitedOn: null,
  ...over,
});
const proposal: DeskProposal = {
  id: "a",
  title: "Review",
  clientName: "Pellham",
  ownerName: "Maren Hollis",
  mine: true,
  status: "open",
  receivedAt: "2026-11-20T09:00:00Z",
  sentAt: null,
  decidedAt: null,
  engagementId: null,
  contextCount: 0,
  canAct: true,
  canClose: true,
  canArchive: true,
  leadContactId: null,
  leadName: null,
};
const ADAEZE: RosterTeammate = { profileId: "p-adaeze", name: "Adaeze Nwosu", role: "lead" };

function open(over: { roster?: RosterContact[]; teammates?: RosterTeammate[]; link?: (id: string) => Promise<TeammateLinkResult>; noLink?: boolean } = {}) {
  const roster = over.roster ?? [person("c1", "Dana Whitlock"), person("c2", "Christy Johnson", { teammate: true, texts: "agreed" })];
  const preview = vi.fn(async (_id: string, contactId: string): Promise<AskPreview> => ({ ok: true, words: `Hi ${contactId}`, name: contactId, mode: "practice", warning: null }));
  const onSave = vi.fn(async () => ({ ok: true as const }));
  const send = vi.fn(async () => ({ ok: true as const, practice: true }));
  const link = vi.fn(over.link ?? (async () => ({ ok: true as const, contact: person("c9", "Adaeze Nwosu", { teammate: true, needsDetails: true }) })));
  render(
    <LeadSheet
      target={{ proposal, start: "pick" }}
      roster={roster}
      wonWords="Won"
      preview={preview}
      send={send}
      onSave={onSave}
      onClose={() => undefined}
      teammates={over.teammates ?? [ADAEZE]}
      linkTeammate={over.noLink ? undefined : link}
    />,
  );
  return { preview, onSave, send, link };
}

describe("teammates on the lead sheet", () => {
  it("lists teammates first, each tagged, then People we work with", () => {
    open();
    const list = screen.getByRole("radiogroup");
    const text = list.textContent ?? "";
    expect(text.indexOf(LEAD_COPY.teammates)).toBeLessThan(text.indexOf("Christy Johnson"));
    expect(text.indexOf("Christy Johnson")).toBeLessThan(text.indexOf("Adaeze Nwosu"));
    expect(text.indexOf("Adaeze Nwosu")).toBeLessThan(text.indexOf(LEAD_COPY.outside));
    expect(text.indexOf(LEAD_COPY.outside)).toBeLessThan(text.indexOf("Dana Whitlock"));
    expect(screen.getAllByText(LEAD_COPY.teammateTag)).toHaveLength(2);
  });

  it("with no teammates at all, the list reads as before: no headings", () => {
    open({ roster: [person("c1", "Dana Whitlock")], teammates: [] });
    expect(screen.queryByText(LEAD_COPY.teammates)).toBeNull();
    expect(screen.queryByText(LEAD_COPY.outside)).toBeNull();
  });

  it("picking a teammate not on People links them, then picks the People row; nothing is saved or sent", async () => {
    const { link, onSave, send, preview } = open();
    fireEvent.click(screen.getByRole("radio", { name: /Adaeze Nwosu/ }));
    expect(link).toHaveBeenCalledWith("p-adaeze");
    await waitFor(() => expect(screen.getByRole("radio", { name: /Adaeze Nwosu/ }).getAttribute("aria-checked")).toBe("true"));
    expect(preview).toHaveBeenCalledWith("a", "c9");
    expect(onSave).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    // Linked once: the teammate row is gone and the People row stands in its place.
    expect(screen.getAllByRole("radio", { name: /Adaeze Nwosu/ })).toHaveLength(1);
  });

  it("each refusal is said plainly and nothing is picked", async () => {
    for (const reason of ["missing", "full", "not_ready", "unavailable"] as const) {
      const { link } = open({ link: async () => ({ ok: false, reason }) });
      fireEvent.click(screen.getByRole("radio", { name: /Adaeze Nwosu/ }));
      expect(await screen.findByText(LEAD_COPY.linkProblems[reason])).toBeTruthy();
      expect(link).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("radio", { name: /Adaeze Nwosu/ }).getAttribute("aria-checked")).toBe("false");
      cleanup();
    }
  });

  it("a thrown link reads as unavailable", async () => {
    open({ link: async () => Promise.reject(new Error("network")) });
    fireEvent.click(screen.getByRole("radio", { name: /Adaeze Nwosu/ }));
    expect(await screen.findByText(LEAD_COPY.linkProblems.unavailable)).toBeTruthy();
  });

  it("a double click links once", async () => {
    let finish: (value: TeammateLinkResult) => void = () => undefined;
    const { link } = open({ link: () => new Promise((resolve) => (finish = resolve)) });
    const row = screen.getByRole("radio", { name: /Adaeze Nwosu/ });
    fireEvent.click(row);
    fireEvent.click(row);
    expect(link).toHaveBeenCalledTimes(1);
    expect(screen.getByText(LEAD_COPY.linking("Adaeze Nwosu"))).toBeTruthy();
    finish({ ok: true, contact: person("c9", "Adaeze Nwosu", { teammate: true }) });
    await waitFor(() => expect(screen.queryByText(LEAD_COPY.linking("Adaeze Nwosu"))).toBeNull());
  });

  it("without a way to link (an older page), unlinked teammates are not offered", () => {
    open({ noLink: true });
    expect(screen.queryByRole("radio", { name: /Adaeze Nwosu/ })).toBeNull();
    // A teammate already on People is still a person on the list.
    expect(screen.getByRole("radio", { name: /Christy Johnson/ })).toBeTruthy();
  });

  it("with nobody on People but a teammate to offer, the list shows the teammate, not the empty line", () => {
    open({ roster: [] });
    expect(screen.queryByText(LEAD_COPY.noPeople)).toBeNull();
    expect(screen.getByRole("radio", { name: /Adaeze Nwosu/ })).toBeTruthy();
  });
});
