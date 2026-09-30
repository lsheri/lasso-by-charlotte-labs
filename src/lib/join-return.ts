/**
 * Unit S5: leave the invite screen signed out and land back on the same
 * invite. The code is a query parameter, never a path segment.
 */
export function inviteReturnUrl(origin: string, code: string | undefined, eng?: string): string {
  const url = new URL("/join", origin);
  if (code) url.searchParams.set("code", code);
  if (eng) url.searchParams.set("eng", eng);
  return url.toString();
}

export async function signOutAndReturn(deps: {
  signOut: () => Promise<unknown>;
  clearCache: () => Promise<void> | void;
  go: (url: string) => void;
  origin: string;
  code: string | undefined;
  eng?: string | undefined;
}): Promise<void> {
  try {
    await deps.clearCache();
    await deps.signOut();
  } catch (e) {
    // A failed sign out still leaves the screen; the reload shows the real state.
    console.error("[join] sign out", e instanceof Error ? e.message : e);
  }
  // A full load, not a router navigate: the target is the URL already open,
  // which the router treats as no change, so the page never re-read the session.
  deps.go(inviteReturnUrl(deps.origin, deps.code, deps.eng));
}
