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

/**
 * A client shelf exists only for a real client row that is not a quick folder.
 * Quick folders render exactly as they always did, and a label only engagement
 * (client_label with no clients row) is ungrouped, never a group of its own.
 */
export function groupEngagementsByClient<T extends NavEngagement>(
  engagements: readonly T[],
): NavEngagementGroups<T> {
  const shelves = new Map<string, ClientShelf<T>>();
  const flat: T[] = [];

  for (const engagement of engagements) {
    const client = engagement.clients;
    if (client && client.quick_folder === false && client.id) {
      const shelf = shelves.get(client.id) ?? {
        clientId: client.id,
        name: client.name,
        engagements: [] as T[],
      };
      shelf.engagements.push(engagement);
      shelves.set(client.id, shelf);
    } else {
      flat.push(engagement);
    }
  }

  const groups = [...shelves.values()]
    .map((shelf) => ({ ...shelf, engagements: [...shelf.engagements].sort(byCode) }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
