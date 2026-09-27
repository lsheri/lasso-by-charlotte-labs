/**
 * Pass 90: how the sidebar arranges engagements. Pure, so it can be tested
 * without a browser and without a query. Groups are derived only from the
 * clients relation already joined onto each engagement, never from a fresh
 * read of the clients table: a coach must only ever see the clients behind
 * engagements that were shared with them.
 */

export type NavClientRef = { id: string; name: string; quick_folder: boolean } | null | undefined;

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
