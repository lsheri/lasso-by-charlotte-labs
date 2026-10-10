// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn(async () => 1) }));

vi.mock("@tanstack/react-start", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-start")>()),
  useServerFn: () => mocks.save,
}));

vi.mock("@/components/layout/SessionHeader", () => ({ SessionHeader: () => null }));

import { SponsoredDataUseStep } from "@/routes/onboarding";

afterEach(() => {
  cleanup();
  mocks.save.mockClear();
});

const SRC = readFileSync("src/routes/onboarding.tsx", "utf8");

function body(name: string) {
  const start = SRC.indexOf(`async function ${name}`);
  return SRC.slice(start, SRC.indexOf("\n  }\n", start));
}

describe("DU-1 data use at setup", () => {
  it("both share back answers lead to data_use; nothing else does", () => {
    // answerShareBack handles yes and no in one body and ends on data_use.
    expect(body("answerShareBack")).toContain('setStage("data_use")');
    expect(body("answerShareBack")).not.toContain("setStage(afterCreation())");
    expect(SRC.match(/setStage\("data_use"\)/g)).toHaveLength(1);
    // The unsponsored path still goes straight to afterCreation.
    const tail = SRC.slice(SRC.indexOf('setStage("share_back");'), SRC.indexOf("async function answerShareBack"));
    expect(tail).toContain("setStage(afterCreation());");
  });

  it("opens with tier d selected and the switch on", () => {
    render(<SponsoredDataUseStep profileId="p1" onDone={() => {}} />);
    expect(screen.getByText("What leaves this workspace")).toBeTruthy();
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.filter((r) => r.checked)).toHaveLength(1);
    expect(radios[radios.length - 1]?.checked).toBe(true);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });

  it("Continue sends org, d, switch true, onboarding_sponsored", async () => {
    const onDone = vi.fn();
    render(<SponsoredDataUseStep profileId="p1" onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(mocks.save).toHaveBeenCalledWith({
      data: { scope: "org", tier: "d", tier_d_switch: true, surface: "onboarding_sponsored", profile_id: "p1" },
    });
  });

  it("choosing b sends b without a true switch and hides the switch", async () => {
    const onDone = vi.fn();
    render(<SponsoredDataUseStep profileId="p1" onDone={onDone} />);
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[2]!); // order t0, a, b, c, d
    expect(screen.queryByRole("switch")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    const sent = (mocks.save.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(sent.tier).toBe("b");
    expect(sent.tier_d_switch).not.toBe(true);
  });

  it("Not now writes nothing and lands on the same next step", () => {
    const onDone = vi.fn();
    render(<SponsoredDataUseStep profileId="p1" onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(mocks.save).toHaveBeenCalledTimes(0);
    expect(onDone).toHaveBeenCalledOnce();
    expect(SRC).toContain("<SponsoredDataUseStep profileId={duProfileId} onDone={() => setStage(afterCreation())} />");
  });

  it("a failed save never blocks", async () => {
    mocks.save.mockRejectedValueOnce(new Error("no"));
    const onDone = vi.fn();
    render(<SponsoredDataUseStep profileId="p1" onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  });
});
