/**
 * Where imports started from inside an engagement land. The person picks the
 * workstream once and we remember it for that engagement, so the next import
 * from the same page defaults to the same place.
 */
export function connectStreamKey(engagementId: string): string {
  return `lasso.connect.stream.${engagementId}`;
}

export function rememberedStream(engagementId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(connectStreamKey(engagementId));
  } catch {
    return null;
  }
}

export function rememberStream(engagementId: string, taskId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(connectStreamKey(engagementId), taskId);
  } catch {
    /* private mode: the choice just does not persist */
  }
}

/** The workstream an import should default to on this engagement. */
export function defaultStream(
  engagementId: string,
  taskIds: string[],
): string | null {
  const remembered = rememberedStream(engagementId);
  if (remembered && taskIds.includes(remembered)) return remembered;
  return taskIds[0] ?? null;
}
