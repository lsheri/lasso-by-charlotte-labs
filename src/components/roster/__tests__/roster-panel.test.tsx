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
  linkPath: `/texts?w=${ORG}&c=0000000c-0000-4000-8000-000000000007`,
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
    copyText: vi.fn(async () => undefined),
    origin: ORIGIN,
    ...over,
  };
  const view = render(<RosterView {...props} />);
  return { props, view };
}
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

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

  it("asks for a name, a role, and where they work, and never a number or an email", async () => {
    setup();
    await open();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText(COPY.dialog.name)).toBeTruthy();
    expect(within(dialog).getByLabelText(COPY.dialog.role)).toBeTruthy();
    expect(within(dialog).getByLabelText(COPY.dialog.affiliation)).toBeTruthy();
    expect(within(dialog).queryByLabelText(COPY.dialog.firm)).toBeNull();
    expect(dialog.querySelectorAll("input, select")).toHaveLength(3);
    expect(dialog.querySelector('input[type="tel"], input[type="email"]')).toBeNull();
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
    type(COPY.dialog.name, "Eli Zhang");
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
    type(COPY.dialog.name, "Eli Zhang");
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
    type(COPY.dialog.name, "Eli Zhang");
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
    type(COPY.dialog.name, "Eli Zhang");
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
    type(COPY.dialog.name, "Eli Zhang");
    fireEvent.click(screen.getByRole("button", { name: COPY.dialog.save }));
    fireEvent.click(screen.getByRole("button", { name: COPY.dialog.cancel }));
    expect(screen.queryByRole("dialog")).toBeNull();
    finish({ ok: false, reason: "unavailable" });
    await Promise.resolve();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
