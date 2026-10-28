/**
 * The example board is offered only while a board is close to empty. The brief
 * card is seeded for everyone, so it never counts towards the three.
 */
export function boardIsNearEmpty(nodes: readonly { kind: string }[]): boolean {
  return nodes.filter((node) => node.kind !== "brief").length < 3;
}
