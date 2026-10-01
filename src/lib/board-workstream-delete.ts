/**
 * WK1: the rules for what a box on the board may do to the workstream behind
 * it. Pure, so the board, the column header and the tests share one answer.
 */
import { isBoardDefaultTask } from "@/lib/board-default-task";

export type ManagingProfile = { id: string; role?: string | null } | null | undefined;
export type ManagedTask = { id: string; owner_id?: string | null; is_board_default?: boolean | null; work_item_tasks?: readonly unknown[] | null };

/** The column header's gate, verbatim: members only, and only your own. */
export function canManageWorkstream(profile: ManagingProfile, task: { owner_id?: string | null } | null | undefined): boolean {
  return Boolean(profile && task && profile.role !== "coach" && task.owner_id === profile.id);
}

/** Work mapped to a workstream, as the board sees it. */
export function mappedWorkCount(task: ManagedTask | null | undefined): number {
  return task?.work_item_tasks?.length ?? 0;
}

/** Whether this person may delete this workstream from the board right now. */
export function canDeleteWorkstreamFromBoard(input: { profile: ManagingProfile; task: ManagedTask | null | undefined; cardsInBox: number }): boolean {
  const { profile, task, cardsInBox } = input;
  if (!task || isBoardDefaultTask(task)) return false;
  if (!canManageWorkstream(profile, task)) return false;
  return cardsInBox === 0 && mappedWorkCount(task) === 0;
}

export type BoxRemoval =
  /** No Remove item at all. */
  | { offer: "none" }
  /** Today's behaviour: the box goes, nothing else. */
  | { offer: "box"; removable: boolean }
  /** The box goes and its workstream is deleted. */
  | { offer: "workstream"; removable: boolean };

/**
 * What Remove means on one box. A box backed by a workstream the person owns
 * deletes that workstream too. A box backed by somebody else's workstream keeps
 * today's behaviour, and a seeded box they do not own offers nothing.
 */
export function boxRemoval(input: { custom: boolean; seeded: boolean; profile: ManagingProfile; task: ManagedTask | null | undefined; cardsInBox: number; backed?: boolean }): BoxRemoval {
  const { custom, seeded, profile, task, cardsInBox } = input;
  const owns = Boolean(task) && !isBoardDefaultTask(task) && canManageWorkstream(profile, task);
  if (owns) return { offer: "workstream", removable: cardsInBox === 0 && mappedWorkCount(task) === 0 };
  // WK2: a box backed by somebody else's workstream is theirs to remove.
  const backed = input.backed ?? Boolean(task);
  if (custom && !seeded && !backed) return { offer: "box", removable: cardsInBox === 0 };
  return { offer: "none" };
}

export type RegionNameAction =
  | { action: "create" }
  | { action: "rename"; taskId: string }
  | { action: "clear" }
  | { action: "clear_and_delete"; taskId: string }
  | { action: "refuse_clear" }
  | { action: "not_owner" };

/** WK2: a box with no workstream behind it is anybody's to name; a backed one only its owner's. */
export function canRenameBox(input: { backed: boolean; profile: ManagingProfile; task: ManagedTask | null | undefined }): boolean {
  if (!input.backed) return true;
  if (!input.task || isBoardDefaultTask(input.task)) return false;
  return canManageWorkstream(input.profile, input.task);
}

/**
 * Naming a region. A region that already has a workstream renames it; only a
 * region without one creates one. Clearing a name deletes the workstream it
 * made only when it is empty and the person may delete it.
 */
export function regionNameAction(input: { clearing: boolean; taskId: string | null | undefined; task: ManagedTask | null | undefined; profile: ManagingProfile; cardsInBox: number }): RegionNameAction {
  const { clearing, taskId, task, profile, cardsInBox } = input;
  const backed = Boolean(taskId) && !isBoardDefaultTask(task);
  if (backed && taskId && !canManageWorkstream(profile, task)) return { action: "not_owner" };
  if (!clearing) return backed && taskId ? { action: "rename", taskId } : { action: "create" };
  if (!backed || !taskId) return { action: "clear" };
  if (cardsInBox > 0 || mappedWorkCount(task) > 0) return { action: "refuse_clear" };
  return { action: "clear_and_delete", taskId };
}

export const BOARD_WORKSTREAM_COPY = {
  removeBox: "Remove workstream",
  removeAndDelete: "Remove box and delete workstream",
  moveCardsFirst: "Move its cards first",
  confirmTitle: "Delete this workstream?",
  confirmBody: (name: string) => `The box comes off the board and the workstream ${name} is deleted. It holds no work.`,
  confirmKeep: "Keep it",
  confirmDelete: "Delete workstream",
  deleted: "Workstream deleted",
  clearRefused: "This workstream still holds work, so its name stays.",
  notOwner: "Only the person who made this workstream can change it.",
  notDeleted: "That workstream could not be deleted. Nothing changed.",
} as const;
