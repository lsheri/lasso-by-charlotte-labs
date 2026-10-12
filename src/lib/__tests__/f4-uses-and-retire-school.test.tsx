import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { readFileSync } from "node:fs";

const peopleRow: { uses: string[] | null } = { uses: null };
const upsert = vi.fn(async () => ({ error: null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }), getSession: async () => ({ data: { session: null } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: peopleRow, error: null }) }) }),
      upsert,
    }),
  },
}));
const logEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => logEvent(...a) }));

import { UsesChips } from "@/components/person/UsesChips";
import { UsesHomeCard } from "@/components/person/UsesHomeCard";
import { saveUses, usesDim, type PersonUse } from "@/lib/person-uses";
import { coachScopeLine } from "@/lib/invites-shared";
import { eduJoinRedirectSearch } from "@/routes/join_.edu";

function Gate() {
  const [v, setV] = useState<PersonUse[]>([]);
  return (
    <>
      <UsesChips value={v} onChange={setV} />
      <button type="submit" disabled={v.length === 0}>Continue</button>
    </>
  );
}

beforeEach(() => {
  upsert.mockClear();
  logEvent.mockClear();
  peopleRow.uses = null;
});

describe("F4 uses question", () => {
  it("Continue is disabled until a chip is picked", () => {
    render(<Gate />);
    expect(screen.getByText("Continue")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /School/ }));
    expect(screen.getByText("Continue")).not.toBeDisabled();
    expect(screen.getByText("Lasso is for people 18 and over.")).toBeTruthy();
  });

  it("upserts sorted uses on the person's own row", async () => {
    const client = { from: () => ({ upsert }) };
    await saveUses(client, "u1", ["work", "personal", "school"]);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", uses: ["personal", "school", "work"] }),
      { onConflict: "user_id" },
    );
  });

  it("event dim is the sorted join", () => {
    expect(usesDim(["work", "school"])).toBe("school+work");
    expect(usesDim(["work", "personal", "school"])).toBe("personal+school+work");
  });

  it("onboarding wires the question, gating and the school pre-tick", () => {
    const src = readFileSync("src/routes/onboarding.tsx", "utf8");
    expect(src).toContain("disabled={pending || uses.length === 0}");
    expect(src).toContain('intent === "edu" || readEduIntent() ? ["school"] : []');
  });
});

describe("F4 school link", () => {
  it("/join/edu?from=ceiba_uni keeps from and goes to individual signup", () => {
    expect(eduJoinRedirectSearch({ from: "ceiba_uni" })).toEqual({
      intent: "personal",
      mode: "signup",
      from: "ceiba_uni",
    });
    const src = readFileSync("src/routes/join_.edu.tsx", "utf8");
    expect(src).toContain("markEduIntent();");
  });

  it("plans has no School option", () => {
    const src = readFileSync("src/routes/plans.tsx", "utf8");
    expect(src).not.toMatch(/name: "School"/);
    expect(src).not.toMatch(/intent: "edu"/);
  });
});

describe("F4 Home card", () => {
  it("shows only when uses is null and hides after saving", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <UsesHomeCard orgId="o1" />
      </QueryClientProvider>,
    );
    await screen.findByTestId("uses-home-card");
    fireEvent.click(screen.getByRole("button", { name: /Work/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByTestId("uses-home-card")).toBeNull());
    expect(logEvent).toHaveBeenCalledWith("person.uses_declared", "o1", { uses: "work" });
  });

  it("does not show when uses already exists", async () => {
    peopleRow.uses = ["work"];
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <UsesHomeCard orgId="o1" />
      </QueryClientProvider>,
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("uses-home-card")).toBeNull();
  });
});

describe("coachScopeLine grammar", () => {
  it("singular and plural", () => {
    expect(coachScopeLine(["Ada"])).toBe(
      "You will see only the work Ada chooses to share with you. Nothing else in the workspace is visible to you.",
    );
    expect(coachScopeLine(["Ada", "Bo"])).toContain("Ada and Bo choose to share");
  });
});
