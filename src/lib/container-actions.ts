/**
 * Unit 4a: the words around removing a container. Pure, so the lines can be
 * pinned by tests. Removing a container never removes work: its contents lift
 * one level, to its own parent or to the top level.
 */

export type ContainerActionsCopy = {
  confirmTitle: (name: string) => string;
  confirmAction: string;
  cancel: string;
  rename: string;
  moveTo: string;
  remove: string;
  topLevel: string;
  moreActions: (name: string) => string;
};

export const CONTAINER_ACTIONS_COPY: ContainerActionsCopy = {
  confirmTitle: (name) => `Delete ${name}?`,
  confirmAction: "Delete",
  cancel: "Cancel",
  rename: "Rename",
  moveTo: "Move to…",
  remove: "Delete",
  topLevel: "Top level",
  moreActions: (name) => `More actions for ${name}`,
};

function plural(count: number, one: string): string {
  return `${count} ${count === 1 ? one : `${one}s`}`;
}

/** "2 workboards and 1 folder", or "" when both are zero. */
function contentsPhrase(workboards: number, folders: number, workboardWord: string, items = 0): string {
  const parts: string[] = [];
  if (workboards > 0) parts.push(plural(workboards, workboardWord.toLowerCase()));
  if (folders > 0) parts.push(plural(folders, "folder"));
  if (items > 0) parts.push(`${items} ${items === 1 ? "piece" : "pieces"} of work`);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function destination(parentName: string | null): string {
  return parentName ? parentName : "the top level";
}

/** The confirm line, computed from what is actually inside. */
export function deleteConfirmLine(input: {
  name: string;
  workboards: number;
  folders: number;
  parentName: string | null;
  workboardWord: string;
}): string {
  const contents = contentsPhrase(input.workboards, input.folders, input.workboardWord);
  if (!contents) return `${input.name} is removed. It is empty.`;
  const verb = input.workboards + input.folders === 1 ? "moves" : "move";
  return `${input.name} is removed. The ${contents} inside it ${verb} up to ${destination(input.parentName)}.`;
}

/** The confirmation after the fact, built from what the database reports. */
export function deletedLine(input: {
  name: string;
  liftedWorkboards: number;
  liftedFolders: number;
  liftedItems: number;
  liftedToName: string | null;
  workboardWord: string;
}): string {
  const contents = contentsPhrase(
    input.liftedWorkboards,
    input.liftedFolders,
    input.workboardWord,
    input.liftedItems,
  );
  if (!contents) return `${input.name} removed.`;
  return `${input.name} removed. ${contents.charAt(0).toUpperCase()}${contents.slice(1)} moved up to ${destination(input.liftedToName)}.`;
}

/** Reads a count out of the RPC reply; anything odd counts as zero. */
export function liftedCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
