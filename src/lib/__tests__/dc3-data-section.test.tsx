// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataConsentView } from "@/lib/data-consent.functions";
import type { Profile } from "@/hooks/use-profile";

const mocks = vi.hoisted(() => ({
  profile: null as Profile | null,
  consent: null as DataConsentView | null,
  purposes: { is_admin: true, grants: { operate: true, deidentified_improvement: true } as Record<string, boolean> },
  save: vi.fn(), purposeSave: vi.fn(), present: vi.fn(), research: vi.fn(),
}));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: mocks.profile }) }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/data-consent.functions", () => ({
  getDataConsent: async () => mocks.consent,
  setDataConsent: mocks.save,
  recordResearchChoice: mocks.research,
}));
vi.mock("@/lib/consent.functions", () => ({
  getDataUse: async () => mocks.purposes,
  setDataUse: mocks.purposeSave,
  noteConsentPresented: mocks.present,
}));
vi.mock("@/components/settings/SampleEventDialog", () => ({ SampleEventDialog: () => <button>See an example</button> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { COPY, DataSection } from "@/components/settings/DataSection";
import { SettingsDialogProvider, resolveSettingsSection, useSettingsDialog } from "@/lib/settings-dialog-context";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue({ ok: true });
  mocks.present.mockResolvedValue({ ok: true });
  mocks.purposeSave.mockResolvedValue({ ok: true });
  mocks.research.mockResolvedValue({ ok: true });
  mocks.profile = { id: "p1", user_id: "u1", org_id: "o1", role: "admin", display_name: "Liam", title_band: null, org_name: "Example", org_type: "personal", clients_enabled: false, onboarding: null };
  mocks.consent = { role: "admin", is_admin: true, org_tier: "d", user_tier: "d", org_tier_d_switch: true, org_text_version: "dc-v4", user_text_version: "dc-v4", research_choice: null, changes: [] };
  mocks.purposes = { is_admin: true, grants: { operate: true, deidentified_improvement: true } };
});
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><DataSection /></QueryClientProvider>);
  return { client, ...view };
}
function business(role: string, type: "company" | "partner") {
  if (!mocks.profile || !mocks.consent) throw new Error("Missing fixture");
  mocks.profile = { ...mocks.profile, org_type: type, role };
  mocks.consent = { ...mocks.consent, role, is_admin: role === "admin" };
  mocks.purposes.is_admin = role === "admin";
}
async function choose(name: string) {
  fireEvent.click(await screen.findByRole("radio", { name: new RegExp(`^${name}`) }));
  await screen.findByRole("alertdialog");
  fireEvent.click(screen.getByRole("button", { name: "Save this level" }));
}
describe("DC-3 unified data Settings", () => {
  it("A has one picker, one improvement switch, research and no organisation purpose", async () => {
    mount();
    await screen.findByRole("switch", {}, { timeout: 10000 });
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getAllByRole("switch")).toHaveLength(1);
    expect(screen.queryByText("Analytics for your organisation")).toBeNull();
    expect(screen.queryByText(/your admins|your firm|your organisation/i)).toBeNull();
    expect(screen.getByText("Right now: Full work content.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Join" })).toBeTruthy();
    expect(mocks.present).toHaveBeenCalledTimes(1);
  });
  it("A saves org then user at Work details with a false content switch", async () => {
    mount(); await choose("Work details");
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
    expect(mocks.save.mock.calls.map(([input]) => input)).toEqual([
      { data: { scope: "org", tier: "c", tier_d_switch: false, surface: "personal_settings", profile_id: "p1" } },
      { data: { scope: "user", tier: "c", surface: "personal_settings", profile_id: "p1" } },
    ]);
  });
  it("A does not write user until org succeeds and never writes user after org fails", async () => {
    mocks.save.mockRejectedValueOnce(new Error("Refused"));
    mount(); await choose("Work details");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it("A sets the content switch true at Full work content and has one user-worded confirmation", async () => {
    if (!mocks.consent) throw new Error("Missing fixture");
    mocks.consent = { ...mocks.consent, org_tier: "c", user_tier: "c" };
    mount();
    fireEvent.click(await screen.findByRole("radio", { name: /^Full work content/ }));
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    expect(screen.getByRole("alertdialog").textContent).not.toContain("whole organization's data");
    fireEvent.click(screen.getByRole("button", { name: "Save this level" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
    expect(mocks.save.mock.calls[0]?.[0].data.tier_d_switch).toBe(true);
  });
  it.each(["company", "partner"] as const)("B %s member has the ceiling sentence and no switches", async (type) => {
    business("member", type); mount();
    await screen.findByText("Example allows up to Full work content. Your workspace admin sets this.");
    await screen.findByText(COPY.improvement);
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(mocks.present).not.toHaveBeenCalled();
    await choose("Work details");
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0]?.[0].data).toEqual({ scope: "user", tier: "c", surface: "personal_settings", profile_id: "p1" });
  });
  it("B only describes explicitly granted improvement and keeps ceiling-blocked levels", async () => {
    business("member", "company");
    mocks.purposes.grants["deidentified_improvement"] = false;
    if (!mocks.consent) throw new Error("Missing fixture");
    mocks.consent = { ...mocks.consent, org_tier: "b", user_tier: "b" };
    mount();
    await screen.findByText("Example allows up to Usage patterns, linked over time. Your workspace admin sets this.");
    expect(screen.queryByText(COPY.improvement)).toBeNull();
    expect((screen.getByRole("radio", { name: /^Work details/ }) as HTMLInputElement).disabled).toBe(true);
  });
  it.each(["company", "partner"] as const)("C %s admin has workspace controls and three purpose switches", async (type) => {
    business("admin", type); const view = mount();
    await screen.findByRole("switch", { name: "Analytics for your organisation" });
    expect(screen.getByText(COPY.wholeWorkspace)).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(10);
    const purposes = screen.getByRole("heading", { name: COPY.purposes }).parentElement;
    if (!purposes) throw new Error("Missing purposes");
    expect(within(purposes).getAllByRole("switch")).toHaveLength(3);
    expect(screen.getByText("Changes")).toBeTruthy();
    expect(mocks.present).toHaveBeenCalledTimes(1);
    await view.client.invalidateQueries({ queryKey: ["data-use", "p1"] });
    expect(mocks.present).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("switch", { name: "Include shared work content" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0]?.[0].data.surface).toBe("org_settings");
  });
  it("D coach shows only the plain line and no controls or presentation event", async () => {
    business("coach", "company"); const view = mount();
    await screen.findByText(COPY.coach);
    expect(view.container.textContent).toBe(COPY.coach);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(mocks.present).not.toHaveBeenCalled();
  });
  it("maps the legacy section when opened through the real context", () => {
    function Probe() { const ctx = useSettingsDialog(); return <><button onClick={() => ctx.openSettings("data-use")}>Open</button><p>{ctx.section}</p></>; }
    render(<SettingsDialogProvider><Probe /></SettingsDialogProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("your-data")).toBeTruthy();
    expect(resolveSettingsSection("support")).toBe("support");
  });
  it("both section lists compose DataSection, and People no longer mounts OrgDataCard", () => {
    for (const file of ["src/pages/SettingsPage.tsx", "src/components/settings/SettingsDialog.tsx"]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain('id: "data-use"');
      expect(source).toContain('id: "your-data"');
      expect(source).toContain("<DataSection />");
    }
    expect(readFileSync("src/pages/MembersPage.tsx", "utf8")).not.toContain("OrgDataCard");
    expect(readFileSync("src/routes/_authenticated/settings.tsx", "utf8")).toContain("section: resolveSettingsSection(section)");
  });
  it("new copy is pinned and passes the language law", () => {
    expect(COPY.ceiling("Example", "Work details")).toBe("Example allows up to Work details. Your workspace admin sets this.");
    expect(COPY.coach).toBe("Nothing of yours leaves through this workspace. You see only what people choose to share with you.");
    for (const value of Object.values(COPY)) {
      const text = typeof value === "function" ? value("Example", "Work details") : value;
      expect(text).not.toMatch(/\b(monitor|monitoring|track|audit|surveillance|score|telemetry|analytics|spy)\b|\u2014/i);
    }
  });
});