// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

let orgType = "partner";
vi.mock("@/hooks/use-profile", () => ({
  fetchProfile: async () => ({ org_type: orgType }),
  useProfile: () => ({ data: { id: "p1", org_id: "o1", org_type: "partner" } }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) }) },
}));

const { requirePartnerWorkspace } = await import("@/lib/partner-guard");
const { KeyRequestsPage, adminLink, attendeeLink, parseEmails } = await import("@/pages/KeyRequestsPage");

afterEach(cleanup);

describe("partner key requests", () => {
  it("redirects a non-partner workspace away", async () => {
    for (const t of ["company", "edu", "personal"]) {
      orgType = t;
      await expect(requirePartnerWorkspace()).rejects.toBeTruthy();
    }
    orgType = "partner";
    await expect(requirePartnerWorkspace()).resolves.toBeUndefined();
  });

  it("hides the admin email for Individuals and shows it for a company", () => {
    render(<QueryClientProvider client={new QueryClient()}><KeyRequestsPage /></QueryClientProvider>);
    fireEvent.click(screen.getByLabelText(/A company/));
    expect(screen.queryByText("Who will run it at their end")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Individuals/));
    expect(screen.queryByText("Who will run it at their end")).toBeNull();
  });

  it("builds links and parses emails", () => {
    expect(attendeeLink("ABC")).toBe("https://lasso.charlotte-labs.com/j/ABC");
    expect(adminLink("XYZ")).toBe("https://lasso.charlotte-labs.com/join?code=XYZ");
    expect(parseEmails(" a@x.com,\n\nb@y.com ,")).toEqual(["a@x.com", "b@y.com"]);
    expect(parseEmails("")).toEqual([]);
  });
});
