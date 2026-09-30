/** Whether this workspace uses clients at all. The vocabulary decides WORDS;
 *  this decides CAPABILITY. An admin changes it in Settings. */
export function clientsEnabled(profile: { clients_enabled?: boolean } | null | undefined): boolean {
  return profile?.clients_enabled === true;
}
