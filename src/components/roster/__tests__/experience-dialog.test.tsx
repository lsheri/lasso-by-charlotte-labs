// @vitest-environment jsdom
// 20 Nov 2026 (Liam, D-86): experience on a person, on the People tab. Server functions are props, so plain mocks.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/roster.functions", () => ({ listRosterFn: vi.fn(), saveRosterContactFn: vi.fn() }));
vi.mock("@/lib/roster-experience.functions", () => ({}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { ExperienceDialog, type ExperienceActions } from "@/components/roster/ExperienceDialog";
import { RosterView } from "@/components/roster/RosterPanel";
import { EXPERIENCE_COPY, EXPERIENCE_MAX_CHARS, type ExperienceResult, type ExperienceView } from "@/lib/roster-experience-shared";
import type { RosterContact } from "@/lib/roster-shared";

afterEach(cleanup);

const PERSON = { id: "0000000c-0000-4000-8000-000000000007", name: "Christy Johnson" };
const FILE = "44444444-4444-4444-8444-444444444444";
const view = (over: Partial<ExperienceView> = {}): ExperienceView => ({ blurb: "", files: [], ...over });
const ok = (experience: ExperienceView): ExperienceResult => ({ ok: true, experience });

function actions(over: Partial<ExperienceActions> = {}): ExperienceActions {
  return {
    load: vi.fn(async () => ok(view({ blurb: "Senior living operations" }))),
    saveBlurb: vi.fn(async (_id: string, blurb: string) => ok(view({ blurb: blurb.trim() }))),
    start: vi.fn(async () => ({ ok: true as const, path: "o/p/f.pdf", token: "t" })),
    upload: vi.fn(async () => true),
    finish: vi.fn(async () => ok(view({ files: [{ id: FILE, name: "Resume.pdf", size: 2048, addedOn: "2026-11-20T12:00:00Z" }] }))),
    remove: vi.fn(async () => ok(view())),
    open: vi.fn(async () => ({ ok: true as const, url: "https://signed.example/once" })),
    ...over,
  };
}
const dialog = (a: ExperienceActions, onChanged = vi.fn()) => {
  render(<ExperienceDialog person={PERSON} actions={a} onClose={vi.fn()} onChanged={onChanged} />);
  return onChanged;
};
const box = () => screen.getByLabelText(EXPERIENCE_COPY.blurb) as HTMLTextAreaElement;
const pick = (file: File) => fireEvent.change(document.querySelector("#experience-file") as HTMLInputElement, { target: { files: [file] } });

describe("the experience dialog", () => {
  it("stays locked until what is saved has loaded, then shows it", async () => {
    let finish: (value: ExperienceResult) => void = () => {};
    const a = actions({ load: vi.fn(() => new Promise<ExperienceResult>((resolve) => { finish = resolve; })) });
    dialog(a);
    expect(box().disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe(EXPERIENCE_COPY.loading);
    expect((screen.getByRole("button", { name: EXPERIENCE_COPY.add }) as HTMLButtonElement).disabled).toBe(true);
    finish(ok(view({ blurb: "Senior living operations" })));
    await waitFor(() => expect(box().value).toBe("Senior living operations"));
    expect(box().disabled).toBe(false);
  });

  it("saves the blurb once, says Saved, and tells the list", async () => {
    const a = actions();
    const changed = dialog(a);
    await waitFor(() => expect(box().disabled).toBe(false));
    const save = screen.getByRole("button", { name: EXPERIENCE_COPY.save }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(box(), { target: { value: "Twelve years in senior living operations." } });
    fireEvent.click(save);
    fireEvent.click(save);
    await screen.findByText(EXPERIENCE_COPY.saved);
    expect(a.saveBlurb).toHaveBeenCalledTimes(1);
    expect(a.saveBlurb).toHaveBeenCalledWith(PERSON.id, "Twelve years in senior living operations.");
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("will not save one too long, and says why", async () => {
    const a = actions();
    dialog(a);
    await waitFor(() => expect(box().disabled).toBe(false));
    fireEvent.change(box(), { target: { value: "x".repeat(EXPERIENCE_MAX_CHARS + 1) } });
    expect(screen.getByText(EXPERIENCE_COPY.problems.tooLong)).toBeTruthy();
    expect((screen.getByRole("button", { name: EXPERIENCE_COPY.save }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("a refused save keeps the dialog open with the server's line and the typed words", async () => {
    const a = actions({ saveBlurb: vi.fn(async () => ({ ok: false as const, problem: EXPERIENCE_COPY.problems.notAllowed })) });
    dialog(a);
    await waitFor(() => expect(box().disabled).toBe(false));
    fireEvent.change(box(), { target: { value: "New words" } });
    fireEvent.click(screen.getByRole("button", { name: EXPERIENCE_COPY.save }));
    expect((await screen.findByRole("alert")).textContent).toBe(EXPERIENCE_COPY.problems.notAllowed);
    expect(box().value).toBe("New words");
    expect(screen.getByTestId("roster-experience")).toBeTruthy();
  });

  it("adds a document in three steps and lists it", async () => {
    const a = actions();
    dialog(a);
    await waitFor(() => expect(box().disabled).toBe(false));
    const file = new File(["%PDF"], "Resume.pdf", { type: "application/pdf" });
    pick(file);
    await screen.findByText("Resume.pdf");
    expect(a.start).toHaveBeenCalledWith(PERSON.id, { name: "Resume.pdf", size: 4, type: "application/pdf" });
    expect(a.upload).toHaveBeenCalledWith("o/p/f.pdf", "t", file);
    expect(a.finish).toHaveBeenCalledWith(PERSON.id, { name: "Resume.pdf", size: 4, type: "application/pdf", path: "o/p/f.pdf" });
  });

  it("refuses a wrong kind of file before any upload, and says plainly when one did not arrive", async () => {
    const a = actions();
    dialog(a);
    await waitFor(() => expect(box().disabled).toBe(false));
    pick(new File(["x"], "photo.png", { type: "image/png" }));
    expect((await screen.findByRole("alert")).textContent).toBe(EXPERIENCE_COPY.problems.wrongType);
    expect(a.start).not.toHaveBeenCalled();
    cleanup();
    const lost = actions({ upload: vi.fn(async () => false) });
    dialog(lost);
    await waitFor(() => expect(box().disabled).toBe(false));
    pick(new File(["%PDF"], "Resume.pdf", { type: "application/pdf" }));
    expect((await screen.findByRole("alert")).textContent).toBe(EXPERIENCE_COPY.problems.notThere);
    expect(lost.finish).not.toHaveBeenCalled();
  });

  it("opens a document by a short-lived link, and removes one", async () => {
    const opened = vi.spyOn(window, "open").mockImplementation(() => null);
    const a = actions({ load: vi.fn(async () => ok(view({ files: [{ id: FILE, name: "Resume.pdf", size: 2048, addedOn: "2026-11-20T12:00:00Z" }] }))) });
    dialog(a);
    fireEvent.click(await screen.findByRole("button", { name: EXPERIENCE_COPY.openLabel("Resume.pdf") }));
    await waitFor(() => expect(opened).toHaveBeenCalledWith("https://signed.example/once", "_blank", "noopener,noreferrer"));
    fireEvent.click(screen.getByRole("button", { name: EXPERIENCE_COPY.removeLabel("Resume.pdf") }));
    await screen.findByText(EXPERIENCE_COPY.noFiles);
    expect(a.remove).toHaveBeenCalledWith(PERSON.id, FILE);
    opened.mockRestore();
  });

  it("a failed load says so and offers nothing to change", async () => {
    dialog(actions({ load: vi.fn(async () => ({ ok: false as const, problem: EXPERIENCE_COPY.problems.notReady })) }));
    expect((await screen.findByRole("alert")).textContent).toBe(EXPERIENCE_COPY.problems.notReady);
    expect(box().disabled).toBe(true);
  });

  it("draws a file name with markup in it as text", async () => {
    dialog(actions({ load: vi.fn(async () => ok(view({ files: [{ id: FILE, name: '<img src=x onerror="alert(1)">.pdf', size: 10, addedOn: "x" }] }))) }));
    await screen.findByText(/onerror/);
    expect(document.querySelector("[data-experience-files] img")).toBeNull();
  });
});

describe("on the People list", () => {
  const person = (over: Partial<RosterContact>): RosterContact => ({
    id: PERSON.id, name: "Christy Johnson", role: "Senior living", affiliation: "independent", firm: null, texts: "agreed", agreedOn: "2026-11-19",
    stoppedOn: null, confirmed: true, changeUntil: null, linkPath: "/texts?x", phoneMasked: "•••• 0142", email: null, linkedin: null, needsDetails: false, numberDiffers: false, invitedOn: null, ...over,
  });
  const base = { profileId: "p1", save: vi.fn(), askNewNumber: vi.fn(), copyText: vi.fn(async () => {}), origin: "https://lasso.example" };

  it("shows each person's line, or No past work with us yet, and opens their experience", async () => {
    const other = person({ id: "0000000c-0000-4000-8000-000000000008", name: "Ben Stanton" });
    const a = actions();
    render(
      <RosterView
        {...base}
        load={async () => ({ allowed: true, contacts: [person({}), other] })}
        experience={{ summaries: async () => ({ [PERSON.id]: { blurb: "Senior living operations", documents: 2 } }), actions: a }}
      />,
    );
    await waitFor(() => expect(document.querySelectorAll("[data-roster-experience]")).toHaveLength(2));
    await waitFor(() => expect(document.body.textContent).toContain("Experience: Senior living operations · 2 documents"));
    expect(document.body.textContent).toContain(EXPERIENCE_COPY.none);
    fireEvent.click(screen.getByRole("button", { name: EXPERIENCE_COPY.buttonLabel("Christy Johnson") }));
    const d = await screen.findByTestId("roster-experience");
    expect(within(d).getByText(EXPERIENCE_COPY.title("Christy Johnson"))).toBeTruthy();
  });

  it("without the experience wiring, no line and no button", async () => {
    render(<RosterView {...base} load={async () => ({ allowed: true, contacts: [person({})] })} />);
    await screen.findByText("Christy Johnson");
    expect(document.querySelector("[data-roster-experience]")).toBeNull();
    expect(screen.queryByRole("button", { name: EXPERIENCE_COPY.buttonLabel("Christy Johnson") })).toBeNull();
  });

  it("a failed read of the lines leaves the list as it is", async () => {
    render(<RosterView {...base} load={async () => ({ allowed: true, contacts: [person({})] })} experience={{ summaries: async () => { throw new Error("down"); }, actions: actions() }} />);
    await screen.findByText("Christy Johnson");
    await waitFor(() => expect(document.querySelector("[data-roster-experience]")?.textContent).toBe(EXPERIENCE_COPY.none));
  });
});
