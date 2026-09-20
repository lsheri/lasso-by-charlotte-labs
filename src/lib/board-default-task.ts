/**
 * The board's default home for work that is not in a workstream.
 *
 * It is a real task row so mapping and permissions behave normally, but it is
 * never a workstream on any surface. Its items read as free cards.
 */

export type MaybeDefaultTask = { is_board_default?: boolean | null };

export function isBoardDefaultTask(task: MaybeDefaultTask | null | undefined): boolean {
  return Boolean(task?.is_board_default);
}

/** Every task a person should see as a workstream. */
export function workstreamTasks<T extends MaybeDefaultTask>(tasks: readonly T[]): T[] {
  return tasks.filter((task) => !isBoardDefaultTask(task));
}
