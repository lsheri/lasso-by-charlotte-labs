// @vitest-environment jsdom
// 18 Nov, firm brain step 5: the board lead corrects an item's tags. Saved tags load before anything can be changed,
// every choice comes from the fixed lists, a refused save keeps the dialog open, a second click sends nothing, and an
// answer that arrives after the dialog closed is dropped.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/item-tags.functions", () => ({
  readItemTagsFn: (...a: unknown[]) => m.read(...a),
  saveItemTagsFn: (...a: unknown[]) => m.save(...a),
}));

import { ItemTagsDialog } from "@/components/canvas-lab/ItemTagsDialog";
import { BrandVariantContext, SkinContext } from "@/components/skin/use-skin";
import { LabCardMenu } from "@/components/canvas-lab/LabCardMenu";
import { METHODS, ROLES, SITUATIONS, STAGES } from "@/lib/engagement-tags";
import { ITEM_TAGS_COPY, type ItemTagsView } from "@/lib/extract-tags-shared";

const CALL: ItemTagsView = { method: ["survey"], call_role: "founder", stage: null, situation: null, corrected: false, fields: { callRole: true, stage: false, situation: false } };
const SOW: ItemTagsView = { method: [], call_role: null, stage: "draft", situation: "pricing", corrected: true, fields: { callRole: false, stage: true, situation: true } };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function open(props: Partial<Parameters<typeof ItemTagsDialog>[0]> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const view = render(<ItemTagsDialog itemId="item-1" title="CFO interview" profileId="p1" onClose={onClose} onSaved={onSaved} {...props} />);
  return { onClose, onSaved, ...view };
}

const saveButton = () => screen.getByRole("button", { name: ITEM_TAGS_COPY.save }) as HTMLButtonElement;
const method = (name: string) => screen.getByRole("checkbox", { name });
const role = () => screen.getByLabelText(ITEM_TAGS_COPY.roleLabel) as HTMLSelectElement;
const loaded = () => waitFor(() => expect(saveButton().disabled).toBe(false));

// jsdom has no ResizeObserver, and the Checkbox primitive measures itself.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

beforeEach(() => {
  m.read.mockReset().mockResolvedValue(CALL);
  m.save.mockReset().mockResolvedValue({ ...CALL, corrected: true });
});
afterEach(cleanup);

describe("ItemTagsDialog", () => {
  it("loads the saved tags, saves the lead's choices and closes", async () => {
    const { onClose, onSaved } = open();
    await loaded();
    expect(m.read).toHaveBeenCalledWith({ data: { item_id: "item-1", profile_id: "p1" } });
    expect(method("Survey").getAttribute("aria-checked")).toBe("true");
    expect(role().value).toBe("founder");
    fireEvent.click(method("Survey"));
    fireEvent.click(method("Expert calls"));
    fireEvent.click(method("Stakeholder interviews"));
    fireEvent.change(role(), { target: { value: "chief_medical_officer" } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(m.save).toHaveBeenCalledWith({
      data: { item_id: "item-1", profile_id: "p1", method: ["stakeholder_interviews", "expert_calls"], call_role: "chief_medical_officer", stage: null, situation: null, clear: false },
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ corrected: true }));
  });

  it("offers only values from the fixed lists, and only the fields this item has", async () => {
    open();
    await loaded();
    expect(screen.getAllByRole("checkbox")).toHaveLength(METHODS.length);
    expect([...role().options].map((option) => option.value)).toEqual(["", ...ROLES]);
    expect(screen.queryByLabelText(ITEM_TAGS_COPY.stageLabel)).toBeNull();
    expect(screen.queryByLabelText(ITEM_TAGS_COPY.situationLabel)).toBeNull();
    expect(document.querySelector('input[type="text"], textarea')).toBeNull();

    cleanup();
    m.read.mockResolvedValue(SOW);
    open();
    await loaded();
    expect(screen.queryByLabelText(ITEM_TAGS_COPY.roleLabel)).toBeNull();
    expect([...(screen.getByLabelText(ITEM_TAGS_COPY.stageLabel) as HTMLSelectElement).options].map((option) => option.value)).toEqual(["", ...STAGES]);
    expect([...(screen.getByLabelText(ITEM_TAGS_COPY.situationLabel) as HTMLSelectElement).options].map((option) => option.value)).toEqual(["", ...SITUATIONS]);
  });

  it("can clear a tag to none, and can go back to what was read", async () => {
    m.read.mockResolvedValue(SOW);
    const { onClose } = open();
    await loaded();
    expect(screen.getByText(ITEM_TAGS_COPY.correctedNote)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(ITEM_TAGS_COPY.stageLabel), { target: { value: "" } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(m.save).toHaveBeenCalledWith({ data: expect.objectContaining({ stage: null, situation: "pricing", clear: false }) }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    cleanup();
    m.save.mockClear();
    open();
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: ITEM_TAGS_COPY.reset }));
    await waitFor(() => expect(m.save).toHaveBeenCalledWith({ data: expect.objectContaining({ clear: true }) }));
  });

  it("names the product by the look in the helper and the way back, never a typed name", async () => {
    m.read.mockResolvedValue(SOW);
    const show = (skin: "lasso" | "charlotte", variant: "current" | "slate-spool") =>
      render(
        <SkinContext.Provider value={skin}>
          <BrandVariantContext.Provider value={variant}>
            <ItemTagsDialog itemId="item-1" title="SOW" profileId="p1" onClose={vi.fn()} onSaved={vi.fn()} />
          </BrandVariantContext.Provider>
        </SkinContext.Provider>,
      );
    // Charlotte's skin in today's look: her name, and no Lasso.
    show("charlotte", "current");
    await loaded();
    expect(screen.getByRole("button", { name: "Use what Charlotte read" })).toBeTruthy();
    expect(document.body.textContent).toContain("Charlotte reads these when the item is captured");
    expect(document.body.textContent).not.toMatch(/Lasso/);
    cleanup();
    // The same skin under Slate, where the product is Lasso: no Charlotte anywhere in the dialog.
    show("charlotte", "slate-spool");
    await loaded();
    expect(screen.getByRole("button", { name: "Use what Lasso read" })).toBeTruthy();
    expect(document.body.textContent).toContain("Lasso reads these when the item is captured");
    expect(document.body.textContent).not.toMatch(/Charlotte/);
  });

  it("writes the tag copy with one name only, so the look can rename it", () => {
    expect(Object.values(ITEM_TAGS_COPY).join("\n")).not.toMatch(/Charlotte/);
  });

  it("offers no way back to the first reading when nothing was corrected", async () => {
    open();
    await loaded();
    expect(screen.queryByRole("button", { name: ITEM_TAGS_COPY.reset })).toBeNull();
    expect(screen.queryByText(ITEM_TAGS_COPY.correctedNote)).toBeNull();
  });

  it("keeps every field locked until the saved tags arrive, so a slow load never overwrites a choice", async () => {
    const load = deferred<ItemTagsView>();
    m.read.mockReturnValue(load.promise);
    open();
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText(ITEM_TAGS_COPY.loading)).toBeTruthy();
    for (const box of screen.getAllByRole("checkbox")) expect((box as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(method("Co-design workshop"));
    fireEvent.click(saveButton());
    expect(m.save).not.toHaveBeenCalled();
    load.resolve(CALL);
    await loaded();
    expect(method("Survey").getAttribute("aria-checked")).toBe("true");
    expect(method("Co-design workshop").getAttribute("aria-checked")).toBe("false");
  });

  it("says so when the tags cannot be loaded, and never saves over tags it could not read", async () => {
    m.read.mockRejectedValue(new Error("403"));
    const { onClose } = open();
    expect((await screen.findByRole("alert")).textContent).toBe(ITEM_TAGS_COPY.loadFailed);
    expect(saveButton().disabled).toBe(true);
    fireEvent.click(saveButton());
    expect(m.save).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("stays open with a plain line when the server refuses the save", async () => {
    m.save.mockRejectedValue(new Response("Forbidden", { status: 403 }));
    const { onClose, onSaved } = open();
    await loaded();
    fireEvent.click(method("Co-design workshop"));
    fireEvent.click(saveButton());
    expect((await screen.findByRole("alert")).textContent).toBe(ITEM_TAGS_COPY.failed);
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    // The choice is still there, and a second try can go through.
    expect(method("Co-design workshop").getAttribute("aria-checked")).toBe("true");
    m.save.mockResolvedValue({ ...CALL, corrected: true });
    fireEvent.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("stays open when the server rejects a value it does not accept", async () => {
    m.save.mockRejectedValue(new Response(ITEM_TAGS_COPY.badRole, { status: 400 }));
    const { onClose } = open();
    await loaded();
    fireEvent.click(saveButton());
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("sends one save for a double click", async () => {
    const pending = deferred<ItemTagsView>();
    m.save.mockReturnValue(pending.promise);
    const { onClose } = open();
    await loaded();
    fireEvent.click(saveButton());
    fireEvent.click(saveButton());
    fireEvent.submit(saveButton().closest("form")!);
    expect(m.save).toHaveBeenCalledTimes(1);
    expect(saveButton().disabled).toBe(true);
    pending.resolve({ ...CALL, corrected: true });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("drops a save that answers after the dialog was closed", async () => {
    const pending = deferred<ItemTagsView>();
    m.save.mockReturnValue(pending.promise);
    const { onClose, onSaved, rerender } = open();
    await loaded();
    fireEvent.click(saveButton());
    rerender(<ItemTagsDialog itemId={null} title="" profileId="p1" onClose={onClose} onSaved={onSaved} />);
    pending.resolve({ ...CALL, corrected: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("drops a failed save, and a slow load, that belong to an item the dialog has moved on from", async () => {
    const firstLoad = deferred<ItemTagsView>();
    m.read.mockReturnValueOnce(firstLoad.promise).mockResolvedValue(SOW);
    const { onClose, onSaved, rerender } = open();
    rerender(<ItemTagsDialog itemId="item-2" title="SOW" profileId="p1" onClose={onClose} onSaved={onSaved} />);
    await loaded();
    firstLoad.resolve(CALL);
    await Promise.resolve();
    // The first item's tags never replace the second item's.
    expect(screen.queryByLabelText(ITEM_TAGS_COPY.roleLabel)).toBeNull();
    expect((screen.getByLabelText(ITEM_TAGS_COPY.situationLabel) as HTMLSelectElement).value).toBe("pricing");

    const pending = deferred<ItemTagsView>();
    m.save.mockReturnValue(pending.promise);
    fireEvent.click(saveButton());
    rerender(<ItemTagsDialog itemId="item-1" title="CFO interview" profileId="p1" onClose={onClose} onSaved={onSaved} />);
    pending.reject(new Error("late failure"));
    await loaded();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does nothing while closed", () => {
    open({ itemId: null });
    expect(m.read).not.toHaveBeenCalled();
    expect(screen.queryByTestId("item-tags")).toBeNull();
  });
});

describe("the card menu entry", () => {
  const menu = (onTags?: () => void) =>
    render(
      <LabCardMenu selected={false} canBranch={false} local={false} open onOpenChange={() => {}} cardRef={{ current: null }} onSelect={() => {}} onOpen={() => {}} onBranch={() => {}} onHide={() => {}} onDelete={() => {}} onTags={onTags} />,
    );

  it("shows Tags only where the board passes it, and opens the dialog's handler", () => {
    menu();
    expect(screen.queryByRole("menuitem", { name: ITEM_TAGS_COPY.menu })).toBeNull();
    cleanup();
    const onTags = vi.fn();
    menu(onTags);
    fireEvent.click(screen.getByRole("menuitem", { name: ITEM_TAGS_COPY.menu }));
    expect(onTags).toHaveBeenCalledTimes(1);
  });
});
