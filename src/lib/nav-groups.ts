/**
 * Pass 90: how the sidebar arranges engagements. Pure, so it can be tested
 * without a browser and without a query. Groups are derived only from the
 * clients relation already joined onto each engagement, never from a fresh
 * read of the clients table: a coach must only ever see the clients behind
 * engagements that were shared with them.
 */

export type NavClientRef =
  | {
      id: string;
      name: string;
      quick_folder: boolean;
      /** Optional: absent means "client". */
      kind?: "client" | "folder";
      /** Optional: absent means null (a root). */
      parent_id?: string | null;
    }
  | null
  | undefined;

export type NavEngagement = {
  id: string;
  code: string;
  title: string;
  client_label?: string | null;
  clients?: NavClientRef;
};

export type ClientShelf<T extends NavEngagement = NavEngagement> = {
  clientId: string;
  name: string;
  engagements: T[];
};

export type NavEngagementGroups<T extends NavEngagement = NavEngagement> = {
  /** Real clients, each a collapsible shelf. */
  groups: ClientShelf<T>[];
  /** Quick folders and engagements with no client row stay flat at top level. */
  flat: T[];
};

function byCode(a: NavEngagement, b: NavEngagement): number {
  return (a.code ?? "").localeCompare(b.code ?? "");
}

/** The display only shelf for work that belongs to no client. Never a clients row. */
export const INTERNAL_SHELF_ID = "__internal__";
export const INTERNAL_SHELF_NAME = "Internal";

/** The display only shelf that gathers quick folders. Never a clients row. */
export const UNMAPPED_SHELF_ID = "__unmapped__";
export const UNMAPPED_SHELF_NAME = "Unmapped";

/** The two synthetic shelves carry a quiet count; real client shelves do not. */
export function isSyntheticShelf(clientId: string): boolean {
  return clientId === INTERNAL_SHELF_ID || clientId === UNMAPPED_SHELF_ID;
}

/**
 * A client shelf exists for a real client row that is not a quick folder.
 * Engagements with no client row (and label only leftovers) collect under the
 * synthetic "Internal" shelf; quick folders collect under "Unmapped". Real
 * clients sort A to Z first, then Internal, then Unmapped last, and each
 * synthetic shelf appears only when it holds something.
 */
export function groupEngagementsByClient<T extends NavEngagement>(
  engagements: readonly T[],
): NavEngagementGroups<T> {
  const shelves = new Map<string, ClientShelf<T>>();
  const internal: T[] = [];
  const unmapped: T[] = [];
  const flat: T[] = [];

  for (const engagement of engagements) {
    const client = engagement.clients;
    if (client && client.quick_folder === true) {
      unmapped.push(engagement);
    } else if (client && client.quick_folder === false && client.id) {
      const shelf = shelves.get(client.id) ?? {
        clientId: client.id,
        name: client.name,
        engagements: [] as T[],
      };
      shelf.engagements.push(engagement);
      shelves.set(client.id, shelf);
    } else {
      internal.push(engagement);
    }
  }

  const groups = [...shelves.values()]
    .map((shelf) => ({ ...shelf, engagements: [...shelf.engagements].sort(byCode) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (internal.length > 0) {
    groups.push({
      clientId: INTERNAL_SHELF_ID,
      name: INTERNAL_SHELF_NAME,
      engagements: [...internal].sort(byCode),
    });
  }

  if (unmapped.length > 0) {
    groups.push({
      clientId: UNMAPPED_SHELF_ID,
      name: UNMAPPED_SHELF_NAME,
      engagements: [...unmapped].sort(byCode),
    });
  }

  return { groups, flat: [...flat].sort(byCode) };
}



const COLLAPSE_KEY = "lasso.nav.clients";

/** Collapsed client ids. Absent means expanded, which is the default. */
export function readCollapsedClients(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COLLAPSE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function writeCollapsedClients(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(ids));
  } catch {
    /* a browser that refuses storage still gets a working nav */
  }
}

/** How deep the sidebar will ever render. A cap is not a preference: without
 *  one, a cycle the database cannot refuse would render forever. */
export const MAX_CONTAINER_DEPTH = 3;

export type ContainerNode<T extends NavEngagement = NavEngagement> = {
  clientId: string;
  name: string;
  kind: "client" | "folder";
  depth: number;
  engagements: T[];
  children: ContainerNode<T>[];
};

export type ContainerRow = {
  id: string;
  name: string;
  kind: "client" | "folder";
  parent_id: string | null;
  quick_folder?: boolean;
};

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}

/**
 * Builds the container tree from rows already in hand. Not yet rendered
 * anywhere; groupEngagementsByClient still owns the sidebar.
 */
export function buildContainerTree<T extends NavEngagement>(
  rows: readonly ContainerRow[],
  engagements: readonly T[],
): ContainerNode<T>[] {
  // Rule 6, purity: no React, no query, no read of the clients table.
  // Rule 4: quick folders and engagements with no client row are not part of
  // this tree; groupEngagementsByClient keeps owning those.
  const containers = rows.filter((row) => row.quick_folder !== true);
  const byId = new Map(containers.map((row) => [row.id, row]));

  // Rule 4: engagements attach to their own container by clients.id, by code.
  const workFor = new Map<string, T[]>();
  for (const engagement of engagements) {
    const client = engagement.clients;
    if (!client || client.quick_folder === true || !client.id || !byId.has(client.id)) continue;
    const list = workFor.get(client.id) ?? [];
    list.push(engagement);
    workFor.set(client.id, list);
  }

  // Rule 1: a root has no parent, or a parent this viewer cannot see (a coach
  // sees only containers behind shared boards). A self parent, which the
  // database refuses, is treated as a root defensively.
  const isRoot = (row: ContainerRow) =>
    row.parent_id === null || row.parent_id === row.id || !byId.has(row.parent_id);

  const childrenOf = new Map<string, ContainerRow[]>();
  for (const row of containers) {
    if (isRoot(row)) continue;
    const list = childrenOf.get(row.parent_id as string) ?? [];
    list.push(row);
    childrenOf.set(row.parent_id as string, list);
  }

  const emitted = new Set<string>();

  // Rule 2: track ids on the current path; a container already on its own
  // path is dropped from that branch, never revisited.
  // Rule 3: never deeper than MAX_CONTAINER_DEPTH. A child that would sit
  // past the cap is returned as overflow and attached at the cap by the
  // caller, so no work becomes unreachable. Root depth is 0.
  function visit(row: ContainerRow, depth: number, path: Set<string>): ContainerNode<T>[] {
    emitted.add(row.id);
    const node: ContainerNode<T> = {
      clientId: row.id,
      name: row.name,
      kind: row.kind,
      depth,
      engagements: [...(workFor.get(row.id) ?? [])].sort(byCode),
      children: [],
    };
    const overflow: ContainerNode<T>[] = [];
    const nextPath = new Set(path).add(row.id);
    for (const child of [...(childrenOf.get(row.id) ?? [])].sort(byName)) {
      if (nextPath.has(child.id) || emitted.has(child.id)) continue;
      if (depth < MAX_CONTAINER_DEPTH) {
        node.children.push(...visit(child, depth + 1, nextPath));
      } else {
        overflow.push(...visit(child, depth, nextPath));
      }
    }
    // Rule 5: siblings sort by name, independent of input order.
    node.children.sort(byName);
    return [node, ...overflow];
  }

  const roots: ContainerNode<T>[] = [];
  for (const row of [...containers].filter(isRoot).sort(byName)) {
    if (!emitted.has(row.id)) roots.push(...visit(row, 0, new Set()));
  }

  // Rule 2: a container reachable from no root sits only inside a cycle; it
  // is emitted as a root instead of vanishing.
  for (const row of [...containers].sort(byName)) {
    if (!emitted.has(row.id)) roots.push(...visit(row, 0, new Set()));
  }

  return roots.sort(byName);
}

/** How many container levels the sidebar draws. Deliberately lower than
 *  MAX_CONTAINER_DEPTH: that one is a safety limit against a cycle the database
 *  cannot refuse, this one is a legibility limit on a narrow rail. Two container
 *  levels plus an engagement plus its tasks is already four levels of indent. */
export const MAX_SIDEBAR_CONTAINER_DEPTH = 2;

export type FlatContainerRow<T extends NavEngagement = NavEngagement> = {
  node: ContainerNode<T>;
  depth: number;
};

/**
 * Flattens the container tree into sidebar rows.
 * Depth first, parents before children, sibling order preserved as given.
 * A node past MAX_SIDEBAR_CONTAINER_DEPTH is emitted AT the cap and never
 * dropped, so nothing becomes unreachable through a display limit.
 * The returned depth is the clamped render depth.
 */
export function flattenForSidebar<T extends NavEngagement>(
  roots: readonly ContainerNode<T>[],
): FlatContainerRow<T>[] {
  const out: FlatContainerRow<T>[] = [];
  const walk = (node: ContainerNode<T>, depth: number) => {
    out.push({ node, depth: Math.min(depth, MAX_SIDEBAR_CONTAINER_DEPTH) });
    for (const child of node.children) walk(child, depth + 1);
  };
  for (const root of roots) walk(root, 0);
  return out;
}

/**
 * Container rows derived only from the clients relation already joined onto
 * each engagement, never from a read of the clients table. This is what keeps
 * the coach rule true: a coach only ever sees the containers behind
 * engagements that were shared with them.
 * Skips null and quick folders, dedupes by id, sorts by name.
 * Absent kind defaults to "client" (every existing row is a client); absent
 * parent_id defaults to null.
 */
export function containerRowsFromEngagements<T extends NavEngagement>(
  engagements: readonly T[],
): ContainerRow[] {
  const byId = new Map<string, ContainerRow>();
  for (const engagement of engagements) {
    const client = engagement.clients;
    if (!client || client.quick_folder === true || !client.id || byId.has(client.id)) continue;
    byId.set(client.id, {
      id: client.id,
      name: client.name,
      kind: client.kind ?? "client",
      parent_id: client.parent_id ?? null,
      quick_folder: false,
    });
  }
  return [...byId.values()].sort(byName);
}

/**
 * The containers `moving` may be re-parented to. Pure. The rows may already
 * contain a cycle, so every walk tracks visited ids and terminates.
 */
export function eligibleParents(rows: readonly ContainerRow[], moving: string): ContainerRow[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const childrenOf = new Map<string, ContainerRow[]>();
  for (const row of rows) {
    if (row.parent_id && row.parent_id !== row.id) {
      const list = childrenOf.get(row.parent_id) ?? [];
      list.push(row);
      childrenOf.set(row.parent_id, list);
    }
  }

  // Descendants of `moving` and the height of its subtree (a lone node is 0).
  const descendants = new Set<string>();
  function height(id: string, path: Set<string>): number {
    let best = 0;
    for (const child of childrenOf.get(id) ?? []) {
      if (path.has(child.id) || child.id === moving) continue;
      descendants.add(child.id);
      const next = new Set(path).add(child.id);
      best = Math.max(best, 1 + height(child.id, next));
    }
    return best;
  }
  const movingHeight = height(moving, new Set([moving]));

  // A candidate's own depth from the visible rows. Root depth is 0; a missing
  // parent or a cycle ends the walk.
  function depthOf(id: string): number {
    const seen = new Set<string>([id]);
    let depth = 0;
    let current = byId.get(id);
    while (current?.parent_id && byId.has(current.parent_id) && !seen.has(current.parent_id)) {
      seen.add(current.parent_id);
      depth += 1;
      current = byId.get(current.parent_id);
    }
    return depth;
  }

  return rows
    .filter((row) => {
      // Rule 1: a container cannot be its own parent.
      if (row.id === moving) return false;
      // Rule 2: the cycle refusal. A descendant of `moving` can never become
      // its parent. This is the whole point of the function.
      if (descendants.has(row.id)) return false;
      // Rule 3: quick folders never hold other containers.
      if (row.quick_folder === true) return false;
      // Rule 4: the depth budget is the candidate's depth plus one plus the
      // moving subtree's height, not just the candidate's depth. Refuse if
      // any node of the subtree would land past MAX_CONTAINER_DEPTH.
      if (depthOf(row.id) + 1 + movingHeight > MAX_CONTAINER_DEPTH) return false;
      return true;
    })
    .sort(byName);
}

/** Root depth is 0. A missing parent or a cycle ends the walk. */
export function containerDepth(rows: readonly ContainerRow[], id: string): number {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const visited = new Set<string>([id]);
  let depth = 0;
  let current = byId.get(id);
  while (current?.parent_id && byId.has(current.parent_id) && !visited.has(current.parent_id)) {
    visited.add(current.parent_id);
    depth += 1;
    current = byId.get(current.parent_id);
  }
  return depth;
}

/**
 * Partitions the one visible container tree without reading any other rows.
 * Every folder appears in exactly one output: beneath its visible client, or
 * in the top-level list when it is a root or its parent is not visible.
 * Client nesting is deliberately not represented here; client shelves keep
 * rendering through groupEngagementsByClient as they do today.
 */
export function partitionContainers<T extends NavEngagement>(
  rows: readonly ContainerRow[],
  engagements: readonly T[],
): {
  foldersUnderClient: Map<string, FlatContainerRow<T>[]>;
  topLevelFolders: FlatContainerRow<T>[];
} {
  const roots = buildContainerTree(rows, engagements);
  const foldersUnderClient = new Map<string, FlatContainerRow<T>[]>();

  const folderOnly = (node: ContainerNode<T>): ContainerNode<T> | null => {
    if (node.kind !== "folder") return null;
    return {
      ...node,
      children: node.children
        .map(folderOnly)
        .filter((child): child is ContainerNode<T> => child !== null),
    };
  };

  const visitClients = (node: ContainerNode<T>) => {
    if (node.kind === "client") {
      const folderRoots = node.children
        .map(folderOnly)
        .filter((child): child is ContainerNode<T> => child !== null);
      if (folderRoots.length > 0) {
        foldersUnderClient.set(node.clientId, flattenForSidebar(folderRoots));
      }
    }
    for (const child of node.children) visitClients(child);
  };
  for (const root of roots) visitClients(root);

  const topLevelFolders = flattenForSidebar(
    roots
      .map(folderOnly)
      .filter((node): node is ContainerNode<T> => node !== null),
  );

  return { foldersUnderClient, topLevelFolders };
}

/** Unit 3c: the heading over workboards not yet in any container. A grouping, never a row. */
export function notInContainerLabel(containerWord: string): string {
  return `Not in a ${containerWord.toLowerCase()} yet`;
}

/**
 * Unit 3c: every container row the workspace can read, plus any container only
 * known through a joined workboard (a shared board). A table row wins over a
 * joined copy. Quick folders stay out: the synthetic grouping owns them.
 */
export function mergeContainerRows<T extends NavEngagement>(
  rows: readonly ContainerRow[],
  engagements: readonly T[],
): ContainerRow[] {
  const byId = new Map<string, ContainerRow>();
  for (const row of containerRowsFromEngagements(engagements)) byId.set(row.id, row);
  for (const row of rows) {
    if (row.quick_folder === true) continue;
    byId.set(row.id, { id: row.id, name: row.name, kind: row.kind ?? "client", parent_id: row.parent_id ?? null, quick_folder: false });
  }
  return [...byId.values()].sort(byName);
}
