// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DROP_COPY, NewProposalDialog } from "@/components/proposals/NewProposalDialog";
import { INTAKE_COPY, MAX_CONTEXT_ITEMS } from "@/lib/proposal-desk-shared";

afterEach(cleanup);

const CLIENTS = [{ id: "11111111-1111-4111-8111-111111111111", name: "Marrowfield" }];
/** Work item ids must be uuids for the form to accept them. */
const idFor = (name: string) => `33333333-3333-4333-8333-${String(name.length).padStart(4, "0")}${name.charCodeAt(0).toString(16).padStart(8, "0")}`;
const file = (name: string) => new File(["x"], name, { type: "text/plain" });
const files = (...names: string[]) => ({ files: names.map(file), types: ["Files"] });

function open(over: Partial<Parameters<typeof NewProposalDialog>[0]> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    clients: CLIENTS,
    clientsLoading: false,
    profileId: "22222222-2222-4222-8222-222222222222",
    capture: vi.fn(async (list: File[]) => ({ ids: list.map((f) => idFor(f.name)), failures: [] })),
    create: vi.fn(async () => ({ ok: true as const, id: "new" })),
    onCreated: vi.fn(),
    ...over,
  };
  render(<NewProposalDialog {...props} />);
  return props;
}
const dialog = () => screen.getByTestId("new-proposal");
const zone = () => dialog().querySelector("[data-new-proposal-drop]") as HTMLElement;
const after = (one: Node, two: Node) => Boolean(one.compareDocumentPosition(two) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("New proposal: the documents come first (redraw step 8)", () => {
  it("puts the drop zone before who it is for, what they asked for and the notes", () => {
    open();
    const legend = screen.getByText(INTAKE_COPY.clientLegend);
    const title = screen.getByLabelText(INTAKE_COPY.titleLabel);
    const notes = screen.getByLabelText(INTAKE_COPY.notes);
    expect(after(zone(), legend)).toBe(true);
    expect(after(zone(), title)).toBe(true);
    expect(after(zone(), notes)).toBe(true);
    // The choose button lives inside the zone, at its normal size, with the drop line under it.
    const choose = screen.getByRole("button", { name: INTAKE_COPY.addFiles });
    expect(zone().contains(choose)).toBe(true);
    expect(choose.className).not.toMatch(/\bh-8\b/);
    expect(zone().textContent).toContain(DROP_COPY.orDrop);
  });

  it("a long file name cannot push the dialog wide", () => {
    open();
    expect(dialog().className).toContain("grid-cols-[minmax(0,1fr)]");
    expect(dialog().className).toMatch(/overflow-x-hidden/);
  });

  it("has no labels in spaced capitals", () => {
    open();
    expect(dialog().querySelector(".micro-label, .uppercase")).toBeNull();
    for (const words of [INTAKE_COPY.clientLegend, INTAKE_COPY.titleLabel, INTAKE_COPY.documents, INTAKE_COPY.notes]) {
      expect(screen.getAllByText(words)[0]!.className).toMatch(/text-sm font-medium/);
    }
  });

  it("takes dropped files the same way as chosen ones, one at a time, and lists them", async () => {
    const props = open();
    expect(fireEvent.dragOver(zone(), { dataTransfer: files("a.txt") })).toBe(false);
    expect(zone().getAttribute("data-new-proposal-drop")).toBe("over");
    fireEvent.drop(zone(), { dataTransfer: files("brief.txt", "rfp.txt") });
    expect(zone().getAttribute("data-new-proposal-drop")).toBe("idle");
    await screen.findByText("rfp.txt");
    expect(screen.getByText("brief.txt")).toBeTruthy();
    expect(props.capture).toHaveBeenCalledTimes(2);
    fireEvent.change(screen.getByLabelText(INTAKE_COPY.titleLabel), { target: { value: "Network redesign" } });
    fireEvent.change(screen.getByLabelText(INTAKE_COPY.pickClient), { target: { value: CLIENTS[0]!.id } });
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.create }));
    await waitFor(() => expect(props.create).toHaveBeenCalled());
    expect((props.create as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatchObject({ work_item_ids: [idFor("brief.txt"), idFor("rfp.txt")] });
  });

  it("leaving the zone clears the highlight", () => {
    open();
    fireEvent.dragOver(zone(), { dataTransfer: files("a.txt") });
    fireEvent.dragLeave(zone());
    expect(zone().getAttribute("data-new-proposal-drop")).toBe("idle");
  });

  it("ignores text or a link dragged from the page", () => {
    const props = open();
    expect(fireEvent.dragOver(zone(), { dataTransfer: { files: [], types: ["text/plain"] } })).toBe(true);
    expect(zone().getAttribute("data-new-proposal-drop")).toBe("idle");
    fireEvent.drop(zone(), { dataTransfer: { files: [], types: ["text/uri-list"] } });
    expect(props.capture).not.toHaveBeenCalled();
  });

  it("a drop while files are still going up adds nothing more, and the browser never opens the file instead", async () => {
    let finish: () => void = () => {};
    const capture = vi.fn(() => new Promise<{ ids: string[]; failures: never[] }>((resolve) => { finish = () => resolve({ ids: ["first"], failures: [] }); }));
    open({ capture });
    fireEvent.drop(zone(), { dataTransfer: files("first.txt") });
    await screen.findByText(INTAKE_COPY.uploading(1, 1));
    expect(fireEvent.dragOver(zone(), { dataTransfer: files("second.txt") })).toBe(false);
    expect(zone().getAttribute("data-new-proposal-drop")).toBe("idle");
    expect(fireEvent.drop(zone(), { dataTransfer: files("second.txt") })).toBe(false);
    expect(capture).toHaveBeenCalledTimes(1);
    finish();
    await screen.findByText("first.txt");
    expect(screen.queryByText("second.txt")).toBeNull();
  });

  it("a member with no clients cannot drop anything, so nothing is uploaded for a start that cannot happen", () => {
    const props = open({ canAddClient: false, clients: [] });
    fireEvent.dragOver(zone(), { dataTransfer: files("a.txt") });
    expect(zone().getAttribute("data-new-proposal-drop")).toBe("idle");
    fireEvent.drop(zone(), { dataTransfer: files("a.txt") });
    expect(props.capture).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: INTAKE_COPY.addFiles }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("dropping more than the limit says so and uploads nothing", () => {
    const props = open();
    const many = Array.from({ length: MAX_CONTEXT_ITEMS + 1 }, (_, i) => `doc-${i}.txt`);
    fireEvent.drop(zone(), { dataTransfer: files(...many) });
    expect(screen.getByRole("alert").textContent).toBe(INTAKE_COPY.problems.tooMany);
    expect(props.capture).not.toHaveBeenCalled();
  });

  it("a failed file is named, the others still go up", async () => {
    const capture = vi.fn(async (list: File[]) => (list[0]!.name === "bad.txt" ? { ids: [], failures: [{ name: "bad.txt", reason: "too large" }] } : { ids: [`id-${list[0]!.name}`], failures: [] }));
    open({ capture });
    fireEvent.drop(zone(), { dataTransfer: files("good.txt", "bad.txt") });
    await screen.findByText("good.txt");
    expect(screen.getByRole("alert").textContent).toBe(INTAKE_COPY.problems.upload("bad.txt", "too large"));
  });
});
