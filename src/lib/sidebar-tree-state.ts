import { useEffect, useState } from "react";
import type { ContainerNode, NavEngagement } from "./nav-groups";

export const TREE_COPY = { recent: "Recent", find: "Find a board", noMatch: "No board matches" };
const recentKey = (profileId: string) => `lasso.recent_boards.${profileId}`;
const openKey = (profileId: string) => `lasso.tree_open.${profileId}`;
const changed = "lasso.recent_boards.changed";

function read(key: string): unknown {
  try { return JSON.parse(window.localStorage.getItem(key) ?? "null"); } catch { return null; }
}
function write(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}
export function readRecentBoards(profileId: string): string[] {
  const value = read(recentKey(profileId));
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string"))].slice(0, 3) : [];
}
export function rememberBoardOpen(profileId: string, boardId: string) {
  write(recentKey(profileId), [boardId, ...readRecentBoards(profileId).filter((id) => id !== boardId)].slice(0, 3));
  window.dispatchEvent(new Event(changed));
}
export function useRememberBoardOpen(profileId: string | undefined, boardId: string | undefined) {
  useEffect(() => { if (profileId && boardId) rememberBoardOpen(profileId, boardId); }, [profileId, boardId]);
}
export function useRecentBoards(profileId: string | undefined) {
  const [state, setState] = useState<{ profileId?: string; ids: string[] }>({ ids: [] });
  useEffect(() => {
    const refresh = () => setState({ profileId, ids: profileId ? readRecentBoards(profileId) : [] });
    refresh();
    window.addEventListener(changed, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(changed, refresh); window.removeEventListener("storage", refresh); };
  }, [profileId]);
  return state.profileId === profileId ? state.ids : [];
}
export function treeBoards(roots: ContainerNode<NavEngagement>[]): NavEngagement[] {
  return roots.flatMap((node) => [...node.engagements, ...treeBoards(node.children)]);
}
export function activeBoardChain(roots: ContainerNode<NavEngagement>[], boardId: string | undefined): string[] {
  for (const node of roots) {
    if (node.engagements.some((board) => board.id === boardId)) return [node.clientId];
    const child = activeBoardChain(node.children, boardId);
    if (child.length) return [node.clientId, ...child];
  }
  return [];
}
export function filterBoardTree(roots: ContainerNode<NavEngagement>[], query: string, parentMatches = false): ContainerNode<NavEngagement>[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return roots;
  return roots.flatMap((node) => {
    const matches = parentMatches || node.name.toLocaleLowerCase().includes(needle);
    const engagements = node.engagements.filter((board) => matches || board.title.toLocaleLowerCase().includes(needle));
    const children = filterBoardTree(node.children, query, matches);
    return matches || engagements.length || children.length ? [{ ...node, engagements, children }] : [];
  });
}
export function useContainerOpenState(profileId: string | undefined, ids: string[], activeChain: string[]) {
  const [state, setState] = useState<{ profileId?: string; choices: Record<string, boolean> }>({ choices: {} });
  const chainKey = activeChain.join("\u0000");
  useEffect(() => {
    const value = profileId ? read(openKey(profileId)) : null;
    const choices: Record<string, boolean> = {};
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [id, open] of Object.entries(value)) if (typeof open === "boolean") choices[id] = open;
    }
    for (const id of chainKey.split("\u0000").filter(Boolean)) choices[id] = true;
    setState({ profileId, choices });
  }, [profileId, chainKey]);
  const choices = state.profileId === profileId ? state.choices : {};
  const collapsed = ids.filter((id) => !(choices[id] ?? activeChain.includes(id)));
  function setCollapsed(next: string[]) {
    const nextChoices = { ...choices };
    for (const id of ids) nextChoices[id] = !next.includes(id);
    if (profileId) write(openKey(profileId), nextChoices);
    setState({ profileId, choices: nextChoices });
  }
  return { collapsed, setCollapsed };
}