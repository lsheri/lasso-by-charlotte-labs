/**
 * SH-7a: a board whose workspace differs from the active profile's workspace
 * is a shared space. Extracted as a pure function so the condition the band
 * depends on is pinned by a test; an inline expression shipped dead once
 * because nothing could reach it.
 */
export function isSharedSpace(boardOrgId: string | null | undefined, profileOrgId: string | null | undefined): boolean {
  return Boolean(boardOrgId && profileOrgId && boardOrgId !== profileOrgId);
}
