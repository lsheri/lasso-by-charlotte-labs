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

function open(over: { roster?: RosterContact[]; teammates?: RosterTeammate[]; link?: (id: string, contactId?: string) => Promise<TeammateLinkResult>; noLink?: boolean } = {}) {
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

  it("picking a teammate writes nothing: no link, no save, no send, no preview; it says when they join People (QA M2)", () => {
    const { link, onSave, send, preview } = open();
    fireEvent.click(screen.getByRole("radio", { name: /Adaeze Nwosu/ }));
    expect(screen.getByRole("radio", { name: /Adaeze Nwosu/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(LEAD_COPY.addOnSave("Adaeze Nwosu"))).toBeTruthy();
    expect(link).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(preview).not.toHaveBeenCalled();
    // Closing or picking someone else now leaves nothing behind.
    fireEvent.click(screen.getByRole("radio", { name: /Dana Whitlock/ }));
    expect(screen.queryByText(LEAD_COPY.addOnSave("Adaeze Nwosu"))).toBeNull();
    expect(link).not.toHaveBeenCalled();
  });

  it("Save lead links the teammate, then saves the People row it got back as the lead", async () => {
    const { link, onSave, send } = open();
    fireEvent.click(screen.getByRole("radio", { name: /Adaeze Nwosu/ }));
    fireEvent.click(screen.getByRole("button", { name: LEAD_COPY.save }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("a", "c9"));
    expect(link).toHaveBeenCalledWith("p-adaeze", undefined);
    expect(send).not.toHaveBeenCalled();
  });

  it("Ask links the teammate, then shows their text on the confirm; nothing is sent before Send", async () => {
    const { link, preview, send } = open();
    fireEvent.click(screen.getByRole("radio", { name: /Adaeze Nwosu/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ask Adaeze" }));
    await waitFor(() => expect(link).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(preview).toHaveBeenCalledWith("a", "c9"));
    expect(send).not.toHaveBeenCalled();
  });

  it("a People row with the same name is asked about, never linked silently; Link them links that row on save (QA M1)", async () => {
    const roster = [person("c1", "Dana Whitlock"), person("c7", "Adaeze  NWOSU", { texts: "agreed" })];
    const { link, onSave, preview } = open({ roster });
    fireEvent.click(screen.getByRole("radio", { name: /^Adaeze Nwosu/ }));
    expect(screen.getByText(LEAD_COPY.sameName("Adaeze Nwosu"))).toBeTruthy();
    // Nothing can be saved or asked until the question is answered.
    expect((screen.getByRole("button", { name: LEAD_COPY.save }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: LEAD_COPY.linkThem }));
    expect(screen.getByText(LEAD_COPY.linkOnSave("Adaeze Nwosu"))).toBeTruthy();
    // The existing row's text and agreement are what the preview shows.
    await waitFor(() => expect(preview).toHaveBeenCalledWith("a", "c7"));
    expect(link).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: LEAD_COPY.save }));
    await waitFor(() => expect(link).toHaveBeenCalledWith("p-adaeze", "c7"));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });

  it("No, add them separately makes a new row on save", async () => {
    const roster = [person("c7", "Adaeze Nwosu")];
    const { link } = open({ roster });
    fireEvent.click(screen.getAllByRole("radio", { name: /Adaeze Nwosu/ }).find((el) => el.hasAttribute("data-lead-teammate"))!);
    fireEvent.click(screen.getByRole("button", { name: LEAD_COPY.keepApart }));
    expect(screen.getByText(LEAD_COPY.addOnSave("Adaeze Nwosu"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: LEAD_COPY.save }));
    await waitFor(() => expect(link).toHaveBeenCalledWith("p-adaeze", undefined));
  });

  it("each refusal on save is said plainly, nothing is saved, and the teammate stays picked", async () => {
    for (const reason of ["missing", "full", "not_ready", "unavailable"] as const) {
      const { link, onSave } = open({ link: async () => ({ ok: false, reason }) });
      fireEvent.click(screen.getByRole("radio", { name: /Adaeze Nwosu/ }));
      fireEvent.click(screen.getByRole("button", { name: LEAD_COPY.save }));
      expect(await screen.findByText(LEAD_COPY.linkProblems[reason])).toBeTruthy();
      expect(link).toHaveBeenCalledTimes(1);
      expect(onSave).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it("a thrown link reads as unavailable", async () => {
    open({ link: async () => Promise.reject(new Error("network")) });
    fireEvent.click(screen.getByRole("radio", { name: /Adaeze Nwosu/ }));
    fireEvent.click(screen.getByRole("button", { name: LEAD_COPY.save }));
    expect(await screen.findByText(LEAD_COPY.linkProblems.unavailable)).toBeTruthy();
  });

  it("a double click on Save lead links once", async () => {
    let finish: (value: TeammateLinkResult) => void = () => undefined;
    const { link } = open({ link: () => new Promise((resolve) => (finish = resolve)) });
    fireEvent.click(screen.getByRole("radio", { name: /Adaeze Nwosu/ }));
    const save = screen.getByRole("button", { name: LEAD_COPY.save });
    fireEvent.click(save);
    fireEvent.click(save);
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
