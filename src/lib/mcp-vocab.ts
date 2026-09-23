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
  /**
   * Company boards have a team; personal and edu workspaces are
   * single-member, so nothing placed there is shared with anyone.
   */
  shared: boolean;
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
    shared: true,
  },
  personal: {
    container: "folder",
    containers: "folders",
    board: "project",
    boards: "projects",
    workstream: "step",
    createContainerTool: "create_folder",
    createBoardTool: "create_project",
    shared: false,
  },
  edu: {
    container: "class",
    containers: "classes",
    board: "assignment",
    boards: "assignments",
    workstream: "step",
    createContainerTool: "create_class",
    createBoardTool: "create_assignment",
    shared: false,
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

/**
 * P0 item 6. Two boards can carry the same code. When they do, and only then,
 * the board title is added so one ref means one place.
 */
export function placeRef(code: string, workstreamName: string, boardTitle?: string): string {
  const short = `${code} · ${workstreamName}`;
  return boardTitle ? `${short} (${boardTitle})` : short;
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
/** A scratch board is a real place, but never one Lasso puts forward itself. */
export function isScratchBoard(boardTitle: string | null | undefined): boolean {
  return /test|sandbox/i.test(boardTitle ?? "");
}

export function chooseSuggestion(vocab: McpVocab, signals: SuggestionSignals): PushSuggestion {
  // Scratch boards stay in the places list; they are simply never suggested.
  const places = signals.places.filter((place) => !isScratchBoard(place.boardTitle));
  const known = new Set(places.map((place) => place.ref));

  if (signals.conversationRef && known.has(signals.conversationRef)) {
    return { ref: signals.conversationRef, reason: "This conversation is already on that board." };
  }
  if (signals.projectRef && known.has(signals.projectRef)) {
    return { ref: signals.projectRef, reason: "Earlier work from the same project went there." };
  }
  for (const needle of [signals.projectName, signals.title]) {
    if (!needle || needle.trim().length < 3) continue;
    const hit = places.find((place) => nameMatch(place, needle));
    if (hit) return { ref: hit.ref, reason: `The name matches that ${vocab.board}.` };
  }
  return null;
}

export const SUGGESTION_CAUTION_TEXT =
  "This chat's project is not this board's client. Placing it shares the chat's reasoning with the whole engagement; the inbox keeps it private until you place it yourself.";

/**
 * Founder decision, 23 Sep. A suggestion that came from precedent, for a chat
 * whose project name matches nothing about that place, carries a caution.
 */
export function suggestionCaution(signals: SuggestionSignals, suggestion: PushSuggestion): boolean {
  if (!suggestion || !signals.projectName || !signals.projectName.trim()) return false;
  const fromPrecedent =
    suggestion.ref === signals.conversationRef || suggestion.ref === signals.projectRef;
  if (!fromPrecedent) return false;
  const place = signals.places.find((one) => one.ref === suggestion.ref);
  if (!place) return false;
  return !nameMatch(place, signals.projectName);
}

/* ------------------------------------------------------------------ *
 * Unit M2b: where a pushed item lands, and the words for what happened.
 * ------------------------------------------------------------------ */

/**
 * The sentence every push tool carries about placing work on a board.
 * Only a company board has a team; everywhere else placing is filing,
 * and nothing is shared with anyone.
 */
export function placementLine(vocab: McpVocab): string {
  const sharing = vocab.shared
    ? "Placing work on a board makes it visible to everyone on that engagement, so only pass destination after the user says yes."
    : `Placing work files it under that ${vocab.board}; nothing is shared with anyone. Only pass destination after the user says yes.`;
  const caution = vocab.shared
    ? " If the chat's project is not this board's client, default to the inbox unless the user says otherwise."
    : "";
  return `Before pushing, call lasso_push_options and ask the user: inbox only, or the suggested place? ${sharing}${caution}`;
}

export type SuggestionOutcome = "accepted" | "changed" | "declined" | "none";

export type SourceProject = { name: string; id?: string };

export type PlacementPlan = {
  destination: string | null;
  move: boolean;
  suggestionOutcome: SuggestionOutcome;
  sourceProject: SourceProject | null;
};

const SUGGESTION_OUTCOMES: SuggestionOutcome[] = ["accepted", "changed", "declined", "none"];

/** Read the four optional placement inputs, defensively. */
export function parsePlacementArgs(args: Record<string, unknown>): PlacementPlan {
  const rawDestination = typeof args["destination"] === "string" ? args["destination"].trim() : "";
  const rawOutcome = String(args["suggestion_outcome"] ?? "");
  const project = args["source_project"] as { name?: unknown; id?: unknown } | null | undefined;
  const projectName = typeof project?.name === "string" ? project.name.trim() : "";
  return {
    destination: rawDestination ? rawDestination : null,
    move: args["move"] === true,
    suggestionOutcome: (SUGGESTION_OUTCOMES as string[]).includes(rawOutcome)
      ? (rawOutcome as SuggestionOutcome)
      : "none",
    sourceProject: projectName
      ? { name: projectName, ...(typeof project?.id === "string" && project.id ? { id: project.id } : {}) }
      : null,
  };
}

/** The placement input shape shared by the three push tools. */
export function placementInputs(vocab: McpVocab): Record<string, unknown> {
  return {
    destination: {
      type: "string",
      description: `Optional. A place ref exactly as lasso_list_places or lasso_push_options gave it ("CODE · ${vocab.workstream}"). Leave it out to keep the item in the user's inbox.`,
    },
    move: {
      type: "boolean",
      description: `Optional. Only after the user says yes to moving work already on another ${vocab.board}.`,
    },
    suggestion_outcome: {
      type: "string",
      enum: ["accepted", "changed", "declined", "none"],
      description: "What the user did with Lasso's suggested place.",
    },
    source_project: {
      type: "object",
      description: "Optional. The Project in the source app this chat lives in.",
      properties: { name: { type: "string" }, id: { type: "string" } },
      required: ["name"],
    },
  };
}

/** What mcp_place_item answered, in the workspace's words. */
export function renderPlacement(
  vocab: McpVocab,
  status: string,
  ref: string,
  otherRef: string | null,
): string {
  if (status === "placed" || status === "moved") {
    return vocab.shared
      ? `Saved and placed on ${ref}. Your ${vocab.board} team can see it there.`
      : `Saved and placed on ${ref}.`;
  }
  if (status === "already_here") return `Already on ${ref}.`;
  if (status === "on_other") {
    const other = otherRef ?? `another ${vocab.board}`;
    return `Saved. It is already on ${other}. Ask the user whether to move it to ${ref}; if yes, call again with move: true.`;
  }
  return `Saved to your inbox only; you can't place work on that ${vocab.board}.`;
}

/** An unknown ref never guesses. The item stays in the inbox and says so. */
export function renderUnknownRef(vocab: McpVocab, refs: readonly string[], note?: string): string {
  if (refs.length === 0) return `Saved to your inbox only; that place is not one of yours, and you have no ${vocab.boards} yet.`;
  const head = note
    ? `Saved to your inbox only; ${note}`
    : "Saved to your inbox only; that place is not one of yours.";
  return `${head} Valid places: ${refs.join(", ")}.`;
}

/** Two boards share a code, so the short form cannot pick one. */
export function sharedCodeNote(vocab: McpVocab): string {
  return `Two ${vocab.boards} share that code; use the full ref.`;
}

/** Only a real landing counts as a board target. */
export function placementTarget(status: string): "inbox" | "workboard" {
  return status === "placed" || status === "moved" || status === "already_here"
    ? "workboard"
    : "inbox";
}

