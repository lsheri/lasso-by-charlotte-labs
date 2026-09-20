/**
 * Unit M2a: the words one workspace uses when an outside model talks to Lasso,
 * and the pure decisions that go with them.
 *
 * No React, no DOM, no database. The MCP handler reads the workspace type once
 * and everything else here is a pure function of it, so the words a model sees
 * and the words a person sees cannot drift apart.
 */

export type McpWorkspaceType = "company" | "personal" | "edu";

export type McpVocab = {
  /** What holds boards: a client, a folder, a class. */
  container: string;
  containers: string;
  /** What holds work: an engagement, a project, an assignment. */
  board: string;
  boards: string;
  /** What divides a board: a workstream or a step. */
  workstream: string;
  createContainerTool: string;
  createBoardTool: string;
};

export const MCP_VOCAB: Record<McpWorkspaceType, McpVocab> = {
  company: {
    container: "client",
    containers: "clients",
    board: "engagement",
    boards: "engagements",
    workstream: "workstream",
    createContainerTool: "create_client",
    createBoardTool: "create_engagement",
  },
  personal: {
    container: "folder",
    containers: "folders",
    board: "project",
    boards: "projects",
    workstream: "step",
    createContainerTool: "create_folder",
    createBoardTool: "create_project",
  },
  edu: {
    container: "class",
    containers: "classes",
    board: "assignment",
    boards: "assignments",
    workstream: "step",
    createContainerTool: "create_class",
    createBoardTool: "create_assignment",
  },
};

/**
 * A personal workspace tied to an institution is Ceiba·Uni. It reads the
 * Individual words on purpose: the person is still working on their own.
 */
export function mcpWorkspaceType(
  orgType: string | null | undefined,
  _affiliated?: boolean | null,
): McpWorkspaceType {
  if (orgType === "company") return "company";
  if (orgType === "edu") return "edu";
  return "personal";
}

export function mcpVocabFor(orgType: string | null | undefined, affiliated?: boolean | null): McpVocab {
  return MCP_VOCAB[mcpWorkspaceType(orgType, affiliated)];
}

/** The same sentence on every create tool, in every workspace. */
export const CONFIRM_LINE =
  "Ask the user to confirm the exact name before calling this. If Lasso answers 'already exists', tell the user and use the existing one; never create a second.";

/** One place a pushed item can go, named the way a person would say it. */
export type McpPlace = {
  /** "<engagement code> · <workstream name>", stable and free of ids. */
  ref: string;
  containerName: string | null;
  code: string;
  boardTitle: string;
  workstreamName: string;
};

export function placeRef(code: string, workstreamName: string): string {
  return `${code} · ${workstreamName}`;
}

/** The two create tools this workspace is offered, and nothing else. */
export function createToolsFor(type: McpWorkspaceType, icons: unknown[] = []): unknown[] {
  const v = MCP_VOCAB[type];
  return [
    {
      name: v.createContainerTool,
      title: `Create a ${v.container}`,
      icons,
      description: `Create a new ${v.container} in Lasso. ${CONFIRM_LINE}`,
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: `The ${v.container} name, exactly as the user gave it.` },
        },
        required: ["name"],
      },
    },
    {
      name: v.createBoardTool,
      title: `Create ${v.board === "assignment" ? "an" : "a"} ${v.board}`,
      icons,
      description: `Create a new ${v.board} inside a ${v.container}. ${CONFIRM_LINE}`,
      inputSchema: {
        type: "object",
        properties: {
          container: {
            type: "string",
            description: `The ${v.container} this ${v.board} belongs to, by name or by the ref Lasso gave you.`,
          },
          title: { type: "string", description: `The ${v.board} title, exactly as the user gave it.` },
          first_workstream: {
            type: "string",
            description: `Optional. The first ${v.workstream} to open with.`,
          },
          code: { type: "string", description: "Optional. A short code, if the user asked for one." },
        },
        required: ["container", "title"],
      },
    },
  ];
}

/** The two read tools, in the workspace's words. */
export function readToolsFor(type: McpWorkspaceType, icons: unknown[] = []): unknown[] {
  const v = MCP_VOCAB[type];
  return [
    {
      name: "lasso_list_places",
      title: "List places",
      icons,
      description: `List the ${v.containers}, ${v.boards} and ${v.workstream}s this user works in, each with a short ref. Read-only.`,
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "lasso_push_options",
      title: "Where could this go",
      icons,
      description:
        "Call before push_conversation. Ask the user: inbox only, or the suggested place? Never choose for them.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          vendor: { type: "string" },
          orig_conversation_id: { type: "string" },
          source_project: {
            type: "object",
            properties: { name: { type: "string" }, id: { type: "string" } },
            required: ["name"],
          },
        },
        required: ["title", "vendor"],
      },
    },
  ];
}

/** What one of the create functions answered. */
export type McpCreateStatus = "created" | "existing" | "forbidden" | "invalid";

export type ContainerResult = { status: string; name?: string | null; reason?: string | null };
export type BoardResult = {
  status: string;
  code?: string | null;
  title?: string | null;
  workstream?: string | null;
  reason?: string | null;
};

function refusal(vocab: McpVocab, thing: string, result: { status: string; reason?: string | null }): string {
  if (result.status === "forbidden") {
    return `You cannot create ${thing === "container" ? `a ${vocab.container}` : `a ${vocab.board}`} here${
      result.reason ? `: ${result.reason}` : "."
    }`;
  }
  return `That ${thing === "container" ? vocab.container : vocab.board} name did not work${
    result.reason ? `: ${result.reason}` : "."
  }`;
}

export function renderContainerResult(vocab: McpVocab, result: ContainerResult): string {
  const name = result.name ?? "";
  if (result.status === "created") return `Created ${vocab.container} ${name}.`;
  if (result.status === "existing")
    return `That ${vocab.container} already exists: ${name}. Use the existing one; do not create a second.`;
  return refusal(vocab, "container", result);
}

export function renderBoardResult(
  vocab: McpVocab,
  result: BoardResult,
  containerName: string | null,
): string {
  if (result.status === "created" || result.status === "existing") {
    const head = `${result.code ?? ""} · ${result.title ?? ""}`;
    const workstream = result.workstream ? ` (${vocab.workstream}: ${result.workstream})` : "";
    const where = containerName ? ` for ${containerName}` : "";
    return result.status === "created"
      ? `Created ${vocab.board} ${head}${workstream}${where}.`
      : `That ${vocab.board} already exists: ${head}${workstream}${where}. Use the existing one; do not create a second.`;
  }
  return refusal(vocab, "board", result);
}

/** A place suggestion, with the reason in plain words. */
export type PushSuggestion = { ref: string; reason: string } | null;

export type SuggestionSignals = {
  places: readonly McpPlace[];
  /** (1) This conversation already sits here. */
  conversationRef?: string | null;
  /** (2) Earlier work from the same source project went here. */
  projectRef?: string | null;
  /** (3) Something to match on by name. */
  title?: string | null;
  projectName?: string | null;
};

function nameMatch(place: McpPlace, needle: string): boolean {
  const hay = needle.toLowerCase();
  return [place.containerName, place.boardTitle, place.workstreamName]
    .filter((one): one is string => Boolean(one && one.trim()))
    .some((one) => {
      const word = one.toLowerCase();
      return hay === word || hay.includes(word) || word.includes(hay);
    });
}

/**
 * The server decides where something could go. The model is never asked to
 * guess, and a weak signal answers null rather than a shrug dressed as advice.
 */
export function chooseSuggestion(vocab: McpVocab, signals: SuggestionSignals): PushSuggestion {
  const known = new Set(signals.places.map((place) => place.ref));

  if (signals.conversationRef && known.has(signals.conversationRef)) {
    return { ref: signals.conversationRef, reason: "This conversation is already on that board." };
  }
  if (signals.projectRef && known.has(signals.projectRef)) {
    return { ref: signals.projectRef, reason: "Earlier work from the same project went there." };
  }
  for (const needle of [signals.projectName, signals.title]) {
    if (!needle || needle.trim().length < 3) continue;
    const hit = signals.places.find((place) => nameMatch(place, needle));
    if (hit) return { ref: hit.ref, reason: `The name matches that ${vocab.board}.` };
  }
  return null;
}
