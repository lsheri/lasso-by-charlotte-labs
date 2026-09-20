import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CONFIRM_LINE,
  MCP_VOCAB,
  chooseSuggestion,
  createToolsFor,
  mcpVocabFor,
  mcpWorkspaceType,
  placeRef,
  readToolsFor,
  renderBoardResult,
  renderContainerResult,
  type McpPlace,
} from "../mcp-vocab";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const handler = read("src/lib/mcp-handler.server.ts");

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const names = (tools: unknown[]) => tools.map((tool) => (tool as { name: string }).name);

describe("M2a — the tools one workspace is offered", () => {
  it("a consulting workspace gets client and engagement", () => {
    expect(names(createToolsFor("company"))).toEqual(["create_client", "create_engagement"]);
  });

  it("a personal workspace gets folder and project", () => {
    expect(names(createToolsFor(mcpWorkspaceType("personal", false)))).toEqual([
      "create_folder",
      "create_project",
    ]);
  });

  it("a personal workspace tied to an institution reads the same words", () => {
    expect(mcpWorkspaceType("personal", true)).toBe("personal");
    expect(names(createToolsFor(mcpWorkspaceType("personal", true)))).toEqual([
      "create_folder",
      "create_project",
    ]);
  });

  it("a school workspace gets class and assignment", () => {
    expect(names(createToolsFor("edu"))).toEqual(["create_class", "create_assignment"]);
  });

  it("every create tool carries the confirmation sentence and its own words", () => {
    for (const type of ["company", "personal", "edu"] as const) {
      const tools = createToolsFor(type) as { description: string }[];
      expect(tools).toHaveLength(2);
      for (const tool of tools) expect(tool.description).toContain(CONFIRM_LINE);
      expect(tools[0]!.description).toContain(MCP_VOCAB[type].container);
      expect(tools[1]!.description).toContain(MCP_VOCAB[type].board);
    }
  });

  it("the read tools keep their verb names in every workspace", () => {
    for (const type of ["company", "personal", "edu"] as const) {
      expect(names(readToolsFor(type))).toEqual(["lasso_list_places", "lasso_push_options"]);
    }
    expect((readToolsFor("company")[1] as { description: string }).description).toContain(
      "Never choose for them.",
    );
  });

  it("list_engagements stays for older clients", () => {
    expect(handler).toContain('name: "list_engagements"');
    expect(handler).toContain('if (name === "list_engagements")');
  });
});

describe("M2a — what a create answer reads like", () => {
  const company = MCP_VOCAB.company;

  it("renders created, existing and refused", () => {
    expect(renderContainerResult(company, { status: "created", name: "Cure First" })).toBe(
      "Created client Cure First.",
    );
    expect(renderContainerResult(company, { status: "existing", name: "Cure First" })).toContain(
      "already exists: Cure First",
    );
    expect(renderContainerResult(company, { status: "forbidden", reason: "coaches cannot create" })).toContain(
      "You cannot create a client here",
    );
    expect(renderContainerResult(company, { status: "invalid", reason: "name is empty" })).toContain(
      "did not work",
    );
  });

  it("renders a board in the workspace's words", () => {
    expect(
      renderBoardResult(
        company,
        { status: "created", code: "CFT-01", title: "Diagnostic", workstream: "General" },
        "Cure First",
      ),
    ).toBe("Created engagement CFT-01 · Diagnostic (workstream: General) for Cure First.");
    expect(
      renderBoardResult(
        MCP_VOCAB.edu,
        { status: "created", code: "BIO-02", title: "Lab write-up", workstream: "Draft" },
        "Biology 201",
      ),
    ).toBe("Created assignment BIO-02 · Lab write-up (step: Draft) for Biology 201.");
  });

  it("never shows a raw id in any answer", () => {
    const texts = [
      renderContainerResult(company, { status: "created", name: "Cure First" }),
      renderBoardResult(
        company,
        { status: "existing", code: "CFT-01", title: "Diagnostic", workstream: "General" },
        "Cure First",
      ),
      placeRef("CFT-01", "General"),
    ];
    for (const text of texts) expect(text).not.toMatch(UUID);
  });
});

describe("M2a — where a push could go", () => {
  const places: McpPlace[] = [
    {
      ref: "CFT-01 · General",
      containerName: "Cure First",
      code: "CFT-01",
      boardTitle: "Diagnostic",
      workstreamName: "General",
    },
    {
      ref: "ACM-02 · Pricing",
      containerName: "Acme",
      code: "ACM-02",
      boardTitle: "Margin review",
      workstreamName: "Pricing",
    },
  ];
  const vocab = MCP_VOCAB.company;

  it("(1) the conversation already sitting on a board wins", () => {
    expect(
      chooseSuggestion(vocab, {
        places,
        conversationRef: "ACM-02 · Pricing",
        projectRef: "CFT-01 · General",
        title: "Cure First diagnostic",
      }),
    ).toEqual({ ref: "ACM-02 · Pricing", reason: "This conversation is already on that board." });
  });

  it("(2) earlier work from the same project comes next", () => {
    expect(
      chooseSuggestion(vocab, {
        places,
        projectRef: "ACM-02 · Pricing",
        title: "Cure First diagnostic",
      }),
    ).toEqual({ ref: "ACM-02 · Pricing", reason: "Earlier work from the same project went there." });
  });

  it("(3) a name match is the last signal", () => {
    expect(
      chooseSuggestion(vocab, { places, title: "Notes for Cure First" })?.ref,
    ).toBe("CFT-01 · General");
    expect(
      chooseSuggestion(vocab, { places, projectName: "Pricing", title: "Untitled" })?.ref,
    ).toBe("ACM-02 · Pricing");
  });

  it("answers null when there is no signal", () => {
    expect(chooseSuggestion(vocab, { places, title: "Untitled chat" })).toBeNull();
    expect(chooseSuggestion(vocab, { places: [], conversationRef: "CFT-01 · General" })).toBeNull();
  });

  it("a ref is the code and the workstream, never an id", () => {
    expect(placeRef("CFT-01", "General")).toBe("CFT-01 · General");
    for (const place of places) expect(place.ref).not.toMatch(UUID);
  });
});

describe("M2a — the handler's own wiring", () => {
  it("creates only through the database functions, as the owner", () => {
    expect(handler).toContain('supabaseAdmin.rpc("mcp_create_container", {\n    p_actor: owner.profileId,');
    expect(handler).toContain('supabaseAdmin.rpc("mcp_create_board", {\n    p_actor: owner.profileId,');
    expect(handler).not.toContain('.from("clients").insert');
    expect(handler).not.toContain('.from("engagements").insert');
    expect(handler).not.toContain('.from("tasks").insert');
    expect(handler).not.toContain('.from("engagement_members").insert');
  });

  it("leaves coach memberships out of places", () => {
    expect(handler).toContain('.filter((m) => m.member_role !== "coach")');
  });

  it("records every new tool call and the two new events", () => {
    expect(handler).toContain('logPush(owner, { tool: "list_places" })');
    expect(handler).toContain('logPush(owner, { tool: "push_options" })');
    expect(handler).toContain('logPush(owner, { tool: "create_container" })');
    expect(handler).toContain('logPush(owner, { tool: "create_board" })');
    expect(handler).toContain('eventType: "mcp.push_options_requested"');
    expect(handler).toContain('eventType: "mcp.container_created"');
    expect(handler).toContain('dims: { has_suggestion: suggested ? "true" : "false" }');
    expect(handler).toContain("dims: { entity, workspace_type: type, outcome }");
  });

  it("offers the create pair for the token's workspace only", () => {
    expect(handler).toContain("...readToolsFor(type, ICONS), ...createToolsFor(type, ICONS)");
    expect(handler).toContain("if (name === vocab.createContainerTool)");
    expect(handler).toContain("if (name === vocab.createBoardTool)");
  });

  it("uses the words, not the names, in the vocabulary module", () => {
    expect(mcpVocabFor("company").workstream).toBe("workstream");
    expect(mcpVocabFor("edu").workstream).toBe("step");
    expect(mcpVocabFor(null).workstream).toBe("step");
  });
});

describe("M2a recheck — container matching and owner scope", () => {
  it("quick folders are never matched as containers", () => {
    expect(handler).toContain('.select("id, name, quick_folder")');
    expect(handler).toContain(".filter((row) => !row.quick_folder)");
  });

  it("an exact name wins before any partial match is considered", () => {
    expect(handler).toContain(
      "candidates.find((row) => row.name.toLowerCase() === needle)",
    );
    expect(handler).toContain("const match = exact ?? partials[0];");
  });

  it("several partial matches ask in words and create nothing", () => {
    expect(handler).toContain("partials.length > 1");
    expect(handler).toContain("` did you mean: ${");
    expect(handler).toContain("? Ask the user before creating anything.");
    const ambiguous = handler.slice(
      handler.indexOf("partials.length > 1"),
      handler.indexOf("const match = exact"),
    );
    expect(ambiguous).not.toContain('rpc("mcp_create_board"');
  });

  it("the conversation signal only reads the owner's own work", () => {
    const signal = handler.slice(
      handler.indexOf("if (origId) {"),
      handler.indexOf("conversationRef = await refsForItems"),
    );
    expect(signal).toContain('.eq("orig_conversation_id", origId)');
    expect(signal).toContain('.eq("owner_id", owner.profileId)');
    expect(signal).toContain('.eq("org_id", owner.orgId)');
  });
});
