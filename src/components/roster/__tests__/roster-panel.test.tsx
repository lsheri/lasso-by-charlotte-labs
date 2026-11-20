// @vitest-environment jsdom
// 19 Nov 2026: the roster panel. Its server functions and the clipboard are props of RosterView, so plain mocks here.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/roster.functions", () => ({ listRosterFn: vi.fn(), saveRosterContactFn: vi.fn() }));

import { RosterView, type RosterViewProps } from "@/components/roster/RosterPanel";
import {
  ROSTER_COPY as COPY,
  type RosterContact,
  type RosterChangeResult,
  type RosterInviteResult,
  type RosterList,
  type RosterSaveResult,
} from "@/lib/roster-shared";

afterEach(cleanup);

const ORG = "0000000a-0000-4000-8000-000000000001";
const ORIGIN = "https://lasso.example";
const person = (over: Partial<RosterContact> = {}): RosterContact => ({
  id: "0000000c-0000-4000-8000-000000000007",
  name: "Dana Whitlock",
  role: "Pricing",
  affiliation: "independent",
  firm: null,
  texts: "none",
  agreedOn: null,
  stoppedOn: null,
  confirmed: false,
  changeUntil: null,
  linkPath: `/texts?w=${ORG}&c=0000000c-0000-4000-8000-000000000007`,
  phoneMasked: null,
  email: null,
  linkedin: null,
  needsDetails: false,
  numberDiffers: false,
  invitedOn: null,
  ...over,
});
const tomas = person({
  id: "0000000c-0000-4000-8000-000000000008",
  name: "Tomás Ó Briain-Lee",
  role: null,
  affiliation: "firm",
  firm: "St. Brigid Partners",
  texts: "agreed",
  agreedOn: "2026-11-19",
  linkPath: `/texts?w=${ORG}&c=0000000c-0000-4000-8000-000000000008`,
});

function setup(over: Partial<RosterViewProps> & { list?: RosterList } = {}) {
  const props: RosterViewProps = {
    profileId: "p1",
    load: vi.fn(async () => over.list ?? { allowed: true, contacts: [person(), tomas] }),
    save: vi.fn(async (): Promise<RosterSaveResult> => ({
      ok: true,
      contact: person({ id: "new", name: "New Person" }),
    })),
    askNewNumber: vi.fn(async (): Promise<RosterChangeResult> => ({
      ok: true,
      contact: { ...tomas, changeUntil: "2026-11-27" },
    })),
    copyText: vi.fn(async () => undefined),
    origin: ORIGIN,
    ...over,
  };
  const view = render(<RosterView {...props} />);
  return { props, view };
}
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
/** A new person with the two details every add needs. Fictional: a 555-01 number and an example address. */
const fill = (name: string) => {
  type(COPY.dialog.name, name);
  type(COPY.dialog.phone, "(206) 555-0142");
  type(COPY.dialog.email, "eli@example.test");
};

describe("the list", () => {
  it("shows each person's name, role, where they work and one word for texts", async () => {
    setup();
    expect(screen.getByRole("status").textContent).toBe(COPY.loading);
    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("Dana Whitlock");
    expect(rows[0]?.textContent).toContain(`Pricing · ${COPY.independent}`);
    expect(rows[0]?.textContent).toContain(COPY.texts.none);
    expect(rows[1]?.textContent).toContain("St. Brigid Partners");
    expect(rows[1]?.textContent).toContain(COPY.texts.agreed);
    expect(rows[1]?.textContent).toContain(COPY.agreedOn("2026-11-19"));
  });

  it("draws nothing at all for someone the server does not allow", async () => {
    const { view, props } = setup({ list: { allowed: false } });
    await waitFor(() => expect(props.load).toHaveBeenCalled());
    await waitFor(() => expect(view.container.innerHTML).toBe(""));
  });

  it("says nobody is here yet, with the add button, for an empty roster", async () => {
    setup({ list: { allowed: true, contacts: [] } });
    expect(await screen.findByText(COPY.empty)).toBeTruthy();
    expect(screen.getByRole("button", { name: COPY.add })).toBeTruthy();
  });

  it("says the list did not load, hides add, and loads again on Try again", async () => {
    const load = vi
      .fn<RosterViewProps["load"]>()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue({ allowed: true, contacts: [person()] });
    setup({ load });
    expect((await screen.findByRole("alert")).textContent).toContain(COPY.loadFailed);
    expect(screen.queryByRole("button", { name: COPY.add })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: COPY.retry }));
    expect(await screen.findByText("Dana Whitlock")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shows a name with markup as plain text", async () => {
    const { view } = setup({
      list: { allowed: true, contacts: [person({ name: "<img src=x onerror=alert(1)>" })] },
    });
    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(view.container.querySelector("img")).toBeNull();
  });

  it("ignores a slow answer for a profile the person has left", async () => {
    let finish: (list: RosterList) => void = () => undefined;
    const load = vi
      .fn<RosterViewProps["load"]>()
      .mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
      .mockResolvedValue({ allowed: true, contacts: [tomas] });
    const { view, props } = setup({ load });
    view.rerender(<RosterView {...props} profileId="p2" />);
    expect(await screen.findByText("Tomás Ó Briain-Lee")).toBeTruthy();
    finish({ allowed: true, contacts: [person()] });
    await Promise.resolve();
    expect(screen.queryByText("Dana Whitlock")).toBeNull();
  });
});

describe("copy the text agreement link", () => {
  it("copies that person's own full link, and says nothing was sent", async () => {
    const { props } = setup();
    fireEvent.click(await screen.findByRole("button", { name: COPY.copyLabel("Dana Whitlock") }));
    await waitFor(() =>
      expect(props.copyText).toHaveBeenCalledWith(
        `${ORIGIN}/texts?w=${ORG}&c=0000000c-0000-4000-8000-000000000007`,
      ),
    );
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]!).getByRole("status").textContent).toBe(COPY.copied);
    expect(within(rows[1]!).queryByRole("status")).toBeNull();
    expect(props.save).not.toHaveBeenCalled();
  });

  it("shows the link to copy by hand when the clipboard refuses", async () => {
    setup({ copyText: vi.fn(async () => Promise.reject(new Error("denied"))) });
    fireEvent.click(
      await screen.findByRole("button", { name: COPY.copyLabel("Tomás Ó Briain-Lee") }),
    );
    expect((await screen.findByRole("alert")).textContent).toBe(COPY.copyFailed);
    const box = screen.getByLabelText(COPY.linkLabel("Tomás Ó Briain-Lee")) as HTMLInputElement;
    expect(box.value).toBe(`${ORIGIN}/texts?w=${ORG}&c=0000000c-0000-4000-8000-000000000008`);
    expect(box.readOnly).toBe(true);
  });
});

describe("add and edit", () => {
  const open = async () => fireEvent.click(await screen.findByRole("button", { name: COPY.add }));

  it("asks for a name, a role, where they work, a mobile number, an email and a LinkedIn address", async () => {
    setup();
    await open();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText(COPY.dialog.name)).toBeTruthy();
    expect(within(dialog).getByLabelText(COPY.dialog.role)).toBeTruthy();
    expect(within(dialog).getByLabelText(COPY.dialog.affiliation)).toBeTruthy();
    expect(within(dialog).queryByLabelText(COPY.dialog.firm)).toBeNull();
    expect(within(dialog).getByLabelText(COPY.dialog.phone).getAttribute("type")).toBe("tel");
    expect(within(dialog).getByLabelText(COPY.dialog.email).getAttribute("type")).toBe("email");
    expect(within(dialog).getByLabelText(COPY.dialog.linkedin)).toBeTruthy();
    expect(dialog.querySelectorAll("input, select")).toHaveLength(6);
    // The form says the number is for contact, and that texts wait for the person's own agreement.
    expect(dialog.textContent).toContain(COPY.dialog.description);
    // The three fields are kept out of session recordings.
    for (const id of ["roster-phone", "roster-email", "roster-linkedin"])
      expect(dialog.querySelector(`#${id}`)?.closest(".ph-no-capture")).toBeTruthy();
  });

  it("refuses an add without a number and an email, in plain words, without calling the server", async () => {
    const { props } = setup();
    await open();
    type(COPY.dialog.name, "Eli Zhang");
    fireEvent.click(screen.getByRole("button", { name: COPY.dialog.save }));
    expect(screen.getByText(COPY.problems.phone)).toBeTruthy();
    expect(screen.getByText(COPY.problems.email)).toBeTruthy();
    type(COPY.dialog.phone, "12345");
    type(COPY.dialog.email, "eli@");
    type(COPY.dialog.linkedin, "example.test/eli");
    expect(screen.queryByText(COPY.problems.phone)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: COPY.dialog.save }));
    expect(screen.getByText(COPY.problems.phone)).toBeTruthy();
    expect(screen.getByText(COPY.problems.email)).toBeTruthy();
    expect(screen.getByText(COPY.problems.linkedin)).toBeTruthy();
    expect(props.save).not.toHaveBeenCalled();
    expect(screen.getByLabelText(COPY.dialog.phone).getAttribute("aria-invalid")).toBe("true");
  });

  it("says a number and an email are both needed when the server refuses on that", async () => {
    setup({
      save: vi.fn(async (): Promise<RosterSaveResult> => ({
        ok: false,
        reason: "invalid",
        problems: ["details"],
      })),
    });
    await open();
    fill("Eli Zhang");
    fireEvent.click(screen.getByRole("button", { name: COPY.dialog.save }));
    expect(await screen.findByText(COPY.problems.details)).toBeTruthy();
  });

  it("names the problems without calling the server, and clears each as it is fixed", async () => {
    const { props } = setup();
    await open();
    fireEvent.change(screen.getByLabelText(COPY.dialog.affiliation), { target: { value: "firm" } });
    fireEvent.click(screen.getByRole("button", { name: COPY.dialog.save }));
    expect(screen.getByText(COPY.problems.name)).toBeTruthy();
    expect(screen.getByText(COPY.problems.firm)).toBeTruthy();
    expect(props.save).not.toHaveBeenCalled();
    type(COPY.dialog.name, "Tomás");
    expect(screen.queryByText(COPY.problems.name)).toBeNull();
    expect(screen.getByText(COPY.problems.firm)).toBeTruthy();
  });

  it("saves a new person once, adds them to the list in name order, and closes", async () => {
    const { props } = setup({
      save: vi.fn(async (): Promise<RosterSaveResult> => ({
        ok: true,
        contact: person({ id: "new", name: "Eli Zhang" }),
      })),
    });
    await open();
    fill("Eli Zhang");
    type(COPY.dialog.role, "Bid writer");
    const saveButton = screen.getByRole("button", { name: COPY.dialog.save });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(props.save).toHaveBeenCalledTimes(1);
    expect(props.save).toHaveBeenCalledWith({
      profile_id: "p1",
      id: null,
      name: "Eli Zhang",
      role: "Bid writer",
      affiliation: "independent",
      firm: "",
      phone: "(206) 555-0142",
      email: "eli@example.test",
      linkedin: "",
    });
    expect(screen.getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent)).toEqual(
      ["Dana Whitlock", "Eli Zhang", "Tomás Ó Briain-Lee"],
    );
    expect(props.load).toHaveBeenCalledTimes(1);
  });

  it("opens an edit with the person's fields and sends their id", async () => {
    const edited = { ...tomas, role: "Health economics" };
    const { props } = setup({
      save: vi.fn(async (): Promise<RosterSaveResult> => ({ ok: true, contact: edited })),
    });
    fireEvent.click(
      await screen.findByRole("button", { name: COPY.editLabel("Tomás Ó Briain-Lee") }),
    );
    expect((screen.getByLabelText(COPY.dialog.name) as HTMLInputElement).value).toBe(
      "Tomás Ó Briain-Lee",
    );
    expect((screen.getByLabelText(COPY.dialog.firm) as HTMLInputElement).value).toBe(
      "St. Brigid Partners",
    );
    type(COPY.dialog.role, "Health economics");
    fireEvent.click(screen.getByRole("button", { name: COPY.dialog.save }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(props.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: tomas.id, role: "Health economics", affiliation: "firm" }),
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Health economics · St. Brigid Partners")).toBeTruthy();
  });

  it.each([
    [{ ok: false, reason: "unavailable" } as RosterSaveResult, COPY.failures.unavailable],
    [{ ok: false, reason: "missing" } as RosterSaveResult, COPY.failures.missing],
    [{ ok: false, reason: "full" } as RosterSaveResult, COPY.failures.full],
  ])("keeps the dialog open with a plain line when the server says %j", async (answer, line) => {
    setup({ save: vi.fn(async () => answer) });
    await open();
    fill("Eli Zhang");
    fireEvent.click(screen.getByRole("button", { name: COPY.dialog.save }));
    expect((await screen.findByRole("alert")).textContent).toBe(line);
    expect((screen.getByLabelText(COPY.dialog.name) as HTMLInputElement).value).toBe("Eli Zhang");
    // The list sits behind the open dialog, hidden from assistive tech, and unchanged.
    expect(screen.getAllByRole("listitem", { hidden: true })).toHaveLength(2);
  });

  it("shows the server's field problems when it refuses what the page let through", async () => {
    setup({
      save: vi.fn(async (): Promise<RosterSaveResult> => ({
        ok: false,
        reason: "invalid",
        problems: ["role"],
      })),
    });
    await open();
    fill("Eli Zhang");
    fireEvent.click(screen.getByRole("button", { name: COPY.dialog.save }));
    expect(await screen.findByText(COPY.problems.role)).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe(COPY.failures.invalid);
  });

  it("says who can change the list on a refusal, and that nothing saved on a network error", async () => {
    const save = vi
      .fn<RosterViewProps["save"]>()
      .mockRejectedValueOnce(new Response("Forbidden", { status: 403 }))
      .mockRejectedValueOnce(new Error("offline"));
    setup({ save });
    await open();
    fill("Eli Zhang");
    fireEvent.click(screen.getByRole("button", { name: COPY.dialog.save }));
    expect((await screen.findByRole("alert")).textContent).toBe(COPY.failures.forbidden);
    fireEvent.click(screen.getByRole("button", { name: COPY.dialog.save }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(COPY.failures.unavailable),
    );
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("does nothing more when a save returns after the dialog was cancelled", async () => {
    let finish: (result: RosterSaveResult) => void = () => undefined;
    setup({ save: vi.fn(() => new Promise<RosterSaveResult>((resolve) => (finish = resolve))) });
    await open();
    fill("Eli Zhang");
    fireEvent.click(screen.getByRole("button", { name: COPY.dialog.save }));
    fireEvent.click(screen.getByRole("button", { name: COPY.dialog.cancel }));
    expect(screen.queryByRole("dialog")).toBeNull();
    finish({ ok: false, reason: "unavailable" });
    await Promise.resolve();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("at five firms' size", () => {
  const many = Array.from({ length: 12 }, (_, n) =>
    person({
      id: `id-${n}`,
      name: `Person ${String(n).padStart(2, "0")}`,
      role: n % 2 ? "Pricing" : "Bid writer",
      linkPath: `/texts?w=${ORG}&c=id-${n}`,
    }),
  );

  it("has no search box for a short list, and shows how many people and how many agreed", async () => {
    setup();
    await screen.findAllByRole("listitem");
    expect(screen.queryByLabelText(COPY.search)).toBeNull();
    expect(screen.getByText(COPY.count(2, 2, 1))).toBeTruthy();
  });

  it("filters a long list by name, role or firm as you type, and counts what is shown", async () => {
    setup({ list: { allowed: true, contacts: [...many, tomas] } });
    expect(await screen.findAllByRole("listitem")).toHaveLength(13);
    fireEvent.change(screen.getByLabelText(COPY.search), { target: { value: "brigid" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText(COPY.count(1, 13, 1))).toBeTruthy();
    fireEvent.change(screen.getByLabelText(COPY.search), { target: { value: "pricing" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });

  it("says nobody matches, and clears the search in one press", async () => {
    setup({ list: { allowed: true, contacts: many } });
    await screen.findAllByRole("listitem");
    fireEvent.change(screen.getByLabelText(COPY.search), { target: { value: "zzz" } });
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText(COPY.noMatch)).toBeTruthy();
    expect(screen.queryByText(COPY.empty)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: COPY.clearSearch }));
    expect(screen.getAllByRole("listitem")).toHaveLength(12);
  });

  it("clears the search when the workspace changes", async () => {
    const { view, props } = setup({ list: { allowed: true, contacts: many } });
    await screen.findAllByRole("listitem");
    fireEvent.change(screen.getByLabelText(COPY.search), { target: { value: "zzz" } });
    view.rerender(<RosterView {...props} profileId="p2" />);
    expect(await screen.findAllByRole("listitem")).toHaveLength(12);
    expect((screen.getByLabelText(COPY.search) as HTMLInputElement).value).toBe("");
  });
});

describe("what an admin sees about texts", () => {
  it("says when someone stopped, and whether an agreed number is confirmed by a reply", async () => {
    setup({
      list: {
        allowed: true,
        contacts: [
          person({ id: "a", name: "A Stopped", texts: "stopped", stoppedOn: "2026-11-20" }),
          person({ id: "b", name: "B Agreed", texts: "agreed", agreedOn: "2026-11-19" }),
          person({
            id: "c",
            name: "C Confirmed",
            texts: "agreed",
            agreedOn: "2026-11-19",
            confirmed: true,
          }),
          person({
            id: "d",
            name: "D Waiting",
            texts: "agreed",
            agreedOn: "2026-11-19",
            changeUntil: "2026-11-27",
          }),
        ],
      },
    });
    const rows = await screen.findAllByRole("listitem");
    expect(rows[0]?.textContent).toContain(COPY.texts.stopped);
    expect(rows[0]?.textContent).toContain(COPY.stoppedOn("2026-11-20"));
    expect(rows[1]?.textContent).toContain(COPY.notConfirmed);
    expect(rows[2]?.textContent).toContain(COPY.confirmed);
    expect(rows[2]?.textContent).not.toContain(COPY.notConfirmed);
    expect(rows[3]?.textContent).toContain(COPY.changeOpen("2026-11-27"));
  });

  it("offers a new number only for someone who has agreed, and has no field anywhere to type one", async () => {
    const { view } = setup();
    await screen.findAllByRole("listitem");
    expect(screen.queryByRole("button", { name: COPY.newNumberLabel("Dana Whitlock") })).toBeNull();
    expect(
      screen.getByRole("button", { name: COPY.newNumberLabel("Tomás Ó Briain-Lee") }),
    ).toBeTruthy();
    expect(view.container.querySelector('input[type="tel"]')).toBeNull();
    expect(view.container.textContent).not.toMatch(/\+1\d{10}|\(\d{3}\) \d{3}-\d{4}/);
  });
});

describe("contact details", () => {
  const dana = person({
    phoneMasked: "(•••) •••-0142",
    email: "dana@example.test",
    linkedin: "https://www.linkedin.com/in/dana",
  });
  const legacy = person({ id: "legacy", name: "Old Entry", needsDetails: true });

  it("shows the masked number, the email and a LinkedIn link on a row, kept out of recordings", async () => {
    setup({ list: { allowed: true, contacts: [dana] } });
    const row = (await screen.findAllByRole("listitem"))[0]!;
    expect(row.textContent).toContain(COPY.phoneOnFile("(•••) •••-0142"));
    expect(row.textContent).toContain("dana@example.test");
    const link = within(row).getByRole("link", { name: COPY.linkedinLabel("Dana Whitlock") });
    expect(link.getAttribute("href")).toBe("https://www.linkedin.com/in/dana");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.closest(".ph-no-capture")).toBeTruthy();
    expect(row.textContent).not.toMatch(/\d{3}\D*\d{3}\D*\d{4}/);
  });

  it("marks people who need details, counts them, and says so when one is opened", async () => {
    setup({
      list: {
        allowed: true,
        contacts: [dana, legacy, person({ id: "l2", name: "Older Entry", needsDetails: true })],
      },
    });
    const rows = await screen.findAllByRole("listitem");
    expect(rows[0]?.textContent).not.toContain(COPY.needsDetails);
    expect(rows[1]?.textContent).toContain(COPY.needsDetails);
    expect(screen.getByText(COPY.needsDetailsCount(2))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: COPY.editLabel("Old Entry") }));
    expect(screen.getByText(COPY.dialog.legacy)).toBeTruthy();
  });

  it("shows no count line when everyone has details", async () => {
    setup({ list: { allowed: true, contacts: [dana] } });
    await screen.findAllByRole("listitem");
    expect(screen.queryByText(/need a mobile number|needs a mobile number/)).toBeNull();
  });

  it("lets a person from before be corrected with no details, but takes details only whole", async () => {
    const { props } = setup({ list: { allowed: true, contacts: [legacy] } });
    fireEvent.click(await screen.findByRole("button", { name: COPY.editLabel("Old Entry") }));
    type(COPY.dialog.email, "old@example.test");
    fireEvent.click(screen.getByRole("button", { name: COPY.dialog.save }));
    expect(screen.getByText(COPY.problems.phone)).toBeTruthy();
    expect(props.save).not.toHaveBeenCalled();
    type(COPY.dialog.email, "");
    fireEvent.click(screen.getByRole("button", { name: COPY.dialog.save }));
    await waitFor(() =>
      expect(props.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: "legacy", phone: "", email: "" }),
      ),
    );
  });

  it("opens an edit with the email and LinkedIn filled and the number box empty, never the number itself", async () => {
    const { props } = setup({
      list: { allowed: true, contacts: [dana] },
      save: vi.fn(async (): Promise<RosterSaveResult> => ({ ok: true, contact: dana })),
    });
    fireEvent.click(await screen.findByRole("button", { name: COPY.editLabel("Dana Whitlock") }));
    expect((screen.getByLabelText(COPY.dialog.phone) as HTMLInputElement).value).toBe("");
    expect(screen.getByText(COPY.dialog.phoneKeep("(•••) •••-0142"))).toBeTruthy();
    expect((screen.getByLabelText(COPY.dialog.email) as HTMLInputElement).value).toBe(
      "dana@example.test",
    );
    expect((screen.getByLabelText(COPY.dialog.linkedin) as HTMLInputElement).value).toBe(
      "https://www.linkedin.com/in/dana",
    );
    fireEvent.click(screen.getByRole("button", { name: COPY.dialog.save }));
    await waitFor(() =>
      expect(props.save).toHaveBeenCalledWith(
        expect.objectContaining({ phone: "", email: "dana@example.test" }),
      ),
    );
    // With details on file the email cannot be emptied.
    fireEvent.click(await screen.findByRole("button", { name: COPY.editLabel("Dana Whitlock") }));
    type(COPY.dialog.email, "");
    fireEvent.click(screen.getByRole("button", { name: COPY.dialog.save }));
    expect(screen.getByText(COPY.problems.email)).toBeTruthy();
    expect(props.save).toHaveBeenCalledTimes(1);
  });

  it("says when the agreed number is not the one on file, and which one texts use", async () => {
    setup({
      list: {
        allowed: true,
        contacts: [{ ...dana, texts: "agreed", agreedOn: "2026-11-19", numberDiffers: true }],
      },
    });
    expect((await screen.findAllByRole("listitem"))[0]?.textContent).toContain(COPY.numberDiffers);
  });

  it("has no button that emails anyone", async () => {
    const { view } = setup({ list: { allowed: true, contacts: [dana] } });
    await screen.findAllByRole("listitem");
    expect(view.container.textContent).not.toMatch(/email (them|their)|send (the|their) link/i);
  });

  it("asking for a new number opens the window, copies their link, and says what the link now does", async () => {
    const { props } = setup();
    fireEvent.click(
      await screen.findByRole("button", { name: COPY.newNumberLabel("Tomás Ó Briain-Lee") }),
    );
    await waitFor(() => expect(props.copyText).toHaveBeenCalledWith(ORIGIN + tomas.linkPath));
    expect(props.askNewNumber).toHaveBeenCalledWith("p1", tomas.id);
    const row = screen.getAllByRole("listitem")[1]!;
    expect(within(row).getByRole("status").textContent).toBe(COPY.newNumberDone("2026-11-27"));
    expect(row.textContent).toContain(COPY.changeOpen("2026-11-27"));
  });

  it("still opens the window and shows the link when the clipboard refuses", async () => {
    setup({ copyText: vi.fn(async () => Promise.reject(new Error("denied"))) });
    fireEvent.click(
      await screen.findByRole("button", { name: COPY.newNumberLabel("Tomás Ó Briain-Lee") }),
    );
    expect((await screen.findByRole("alert")).textContent).toBe(COPY.newNumberNoCopy("2026-11-27"));
    expect(
      (screen.getByLabelText(COPY.linkLabel("Tomás Ó Briain-Lee")) as HTMLInputElement).value,
    ).toBe(ORIGIN + tomas.linkPath);
  });

  it.each([
    [{ ok: false, reason: "not_agreed" } as RosterChangeResult, COPY.changeFailures.not_agreed],
    [{ ok: false, reason: "missing" } as RosterChangeResult, COPY.changeFailures.missing],
    [{ ok: false, reason: "unavailable" } as RosterChangeResult, COPY.changeFailures.unavailable],
  ])("says plainly when the server answers %j, and copies nothing", async (answer, line) => {
    const { props } = setup({ askNewNumber: vi.fn(async () => answer) });
    fireEvent.click(
      await screen.findByRole("button", { name: COPY.newNumberLabel("Tomás Ó Briain-Lee") }),
    );
    expect((await screen.findByRole("alert")).textContent).toBe(line);
    expect(props.copyText).not.toHaveBeenCalled();
  });

  it("says nothing changed on a network error, and a second press while one is out does nothing", async () => {
    let fail: (error: Error) => void = () => undefined;
    const askNewNumber = vi.fn(
      () => new Promise<RosterChangeResult>((_resolve, reject) => (fail = reject)),
    );
    setup({ askNewNumber });
    const button = await screen.findByRole("button", {
      name: COPY.newNumberLabel("Tomás Ó Briain-Lee"),
    });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(askNewNumber).toHaveBeenCalledTimes(1);
    fail(new Error("offline"));
    expect((await screen.findByRole("alert")).textContent).toBe(COPY.changeFailures.unavailable);
  });
});

describe("20 Nov: Email the link", () => {
  const withEmail = person({ email: "dana@example.test" });
  it("shows only for someone with an email and no live agreement, and says plainly that nothing is agreed yet", async () => {
    const sendInvite = vi.fn(async (): Promise<RosterInviteResult> => ({ ok: true, contact: { ...withEmail, invitedOn: "2026-11-20" } }));
    setup({ list: { allowed: true, contacts: [withEmail, person({ id: "x2", name: "No Email" }), { ...tomas, email: "t@example.test" }] }, sendInvite });
    await screen.findAllByRole("listitem");
    expect(screen.getAllByRole("button", { name: /^Email the text agreement link/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: COPY.emailLabel("Dana Whitlock") }));
    fireEvent.click(screen.getByRole("button", { name: COPY.emailLabel("Dana Whitlock") }));
    expect(await screen.findByText(COPY.emailed("dana@example.test"))).toBeTruthy();
    expect(sendInvite).toHaveBeenCalledTimes(1);
    expect(sendInvite).toHaveBeenCalledWith("p1", withEmail.id);
    expect(screen.getByText(new RegExp(COPY.emailedOn("2026-11-20")))).toBeTruthy();
  });

  it.each(["no_email", "recent", "unavailable", "missing"] as const)("says why when the server answers %s", async (reason) => {
    setup({ list: { allowed: true, contacts: [withEmail] }, sendInvite: vi.fn(async () => ({ ok: false, reason }) as RosterInviteResult) });
    await screen.findAllByRole("listitem");
    fireEvent.click(screen.getByRole("button", { name: COPY.emailLabel("Dana Whitlock") }));
    expect((await screen.findByRole("alert")).textContent).toBe(COPY.emailFailures[reason]);
  });

  it("when email is not set up, says so and shows the link to copy", async () => {
    setup({ list: { allowed: true, contacts: [withEmail] }, sendInvite: vi.fn(async () => ({ ok: false, reason: "not_set_up" }) as RosterInviteResult) });
    await screen.findAllByRole("listitem");
    fireEvent.click(screen.getByRole("button", { name: COPY.emailLabel("Dana Whitlock") }));
    expect((await screen.findByRole("alert")).textContent).toBe(COPY.emailFailures.not_set_up);
    expect((screen.getByLabelText(COPY.linkLabel("Dana Whitlock")) as HTMLInputElement).value).toBe(ORIGIN + withEmail.linkPath);
  });

  it("a thrown call reads as not sent", async () => {
    setup({ list: { allowed: true, contacts: [withEmail] }, sendInvite: vi.fn(async () => Promise.reject(new Error("down"))) });
    await screen.findAllByRole("listitem");
    fireEvent.click(screen.getByRole("button", { name: COPY.emailLabel("Dana Whitlock") }));
    expect((await screen.findByRole("alert")).textContent).toBe(COPY.emailFailures.unavailable);
  });

  it("has no button when the page gives no sender", async () => {
    setup({ list: { allowed: true, contacts: [withEmail] } });
    await screen.findAllByRole("listitem");
    expect(screen.queryByRole("button", { name: COPY.emailLabel("Dana Whitlock") })).toBeNull();
  });
});
