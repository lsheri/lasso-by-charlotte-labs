/**
 * Removing and deleting are the owner's actions. A coach never sees them, and
 * neither does another member reading someone else's work.
 */
export function ownsWorkItem(
  profile: { id: string; role: string } | null | undefined,
  item: { owner_id?: string | null | undefined },
): boolean {
  if (!profile || profile.role === "coach") return false;
  return Boolean(item.owner_id) && item.owner_id === profile.id;
}
