// Phase 4 PR8: connector and push wording follows the brand. Lasso is untouched; Charlotte names herself in the setup
// steps, the push phrase, the branch prompt and the walkthrough, and never claims a connector name the server does
// not use yet.
import { describe, expect, it } from "vitest";

import { brandCopy, brandFor } from "@/design/brand/brand";
import { branchPrompt } from "@/lib/branch-handoff";
import { MCP_PUSH_PHRASE, MCP_SERVER_NAME, MCP_SETUP_STEPS } from "@/lib/mcp-setup-steps";
import { WALKTHROUGH_VARIANTS, walkthroughFor } from "@/lib/walkthrough";

const lasso = brandFor("lasso");
const charlotte = brandFor("charlotte");

describe("connector wording", () => {
  it("names Charlotte in the steps, the push phrase and the branch prompt", () => {
    expect(brandCopy(charlotte, MCP_PUSH_PHRASE)).toBe("Push this conversation to Charlotte.");
    expect(MCP_SETUP_STEPS.claude.map((step) => brandCopy(charlotte, step)).join(" ")).not.toMatch(/lasso/i);
    expect(brandCopy(charlotte, branchPrompt("b1"))).toBe(
      "Fetch Charlotte branch b1 with the Charlotte connector and load it as context.",
    );
  });

  it("names the server Charlotte Labs now the switch is on", () => {
    expect(MCP_SERVER_NAME).toBe("Charlotte Labs");
  });
});

describe("walkthroughFor", () => {
  it("returns the Lasso walkthrough unchanged", () => {
    for (const variant of WALKTHROUGH_VARIANTS) {
      expect(walkthroughFor(variant, lasso)).toBe(walkthroughFor(variant));
    }
  });

  it("under Charlotte shows no Lasso and names the server as it now shows up", () => {
    for (const variant of WALKTHROUGH_VARIANTS) {
      const guide = walkthroughFor(variant, charlotte);
      const words = JSON.stringify({ ...guide, sections: guide.sections.map(({ video: _video, ...rest }) => rest) });
      expect(words).not.toMatch(/lasso/i);
    }
    const said = walkthroughFor("personal", charlotte).sections.find((section) => section.id === "say_the_sentence");
    expect(said?.body[1]).toBe(
      'In your AI\'s connector list Charlotte shows up as "Charlotte Labs". If nothing arrives, the connector is not set up yet, and the next section fixes that.',
    );
  });
});
