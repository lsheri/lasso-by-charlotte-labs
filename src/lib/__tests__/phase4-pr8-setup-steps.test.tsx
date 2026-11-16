// @vitest-environment jsdom
// Phase 4 PR8: the connector setup steps sit behind a click, out of the brand guard's reach, so they are rendered here.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SetupSteps } from "@/components/connectors/ConnectYourAiCard";
import { SkinContext } from "@/components/skin/use-skin";
import { MCP_SIGNIN_URL } from "@/lib/mcp-setup-steps";
import type { Skin } from "@/lib/skin";

const text = (skin: Skin) =>
  render(
    <SkinContext.Provider value={skin}>
      <SetupSteps />
    </SkinContext.Provider>,
  ).container.textContent ?? "";

describe("SetupSteps", () => {
  it("keeps the Lasso steps and the server's name for Lasso", () => {
    expect(text("lasso")).toContain("Paste your Lasso URL");
    // The server says Charlotte now, so a Lasso page leaves the name line out.
    expect(text("lasso")).not.toContain("The server shows up in your AI");
  });

  it("names Charlotte and the server name it now uses", () => {
    const charlotte = text("charlotte");
    // The sign-in address is the MCP URL, which never changes (lasso.charlotte-labs.com).
    expect(charlotte.replaceAll(MCP_SIGNIN_URL, "")).not.toMatch(/lasso/i);
    expect(charlotte).toContain("Push this conversation to Charlotte.");
    expect(charlotte).toContain("The server shows up in your AI as Charlotte Labs.");
  });
});
