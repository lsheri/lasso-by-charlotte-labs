/** F6: a board-shared email and bell row go out only for a fresh add of someone else. */
export function shouldNotifyShare(result: string, personId: string, actorProfileId: string): boolean {
  return result === "granted" && personId !== actorProfileId;
}
