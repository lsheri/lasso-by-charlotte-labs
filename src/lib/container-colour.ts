export const CONTAINER_COLOURS = ["green", "blue", "rose", "yellow", "lavender", "slate"] as const;

export type ContainerColour = (typeof CONTAINER_COLOURS)[number];

type ColourNode = { color?: unknown };

export function isContainerColour(value: unknown): value is ContainerColour {
  return typeof value === "string" && CONTAINER_COLOURS.includes(value as ContainerColour);
}

export function containerColourStyle(colour: ContainerColour): { dot: string; wash: string } {
  return {
    dot: `var(--nb-region-${colour}-vivid)`,
    wash: `var(--nb-region-${colour}-soft)`,
  };
}

/** The node wins over its ancestors; ancestors are ordered nearest first. */
export function inheritedColour(node: ColourNode, ancestors: readonly ColourNode[]): ContainerColour | null {
  if (isContainerColour(node.color)) return node.color;
  for (const ancestor of ancestors) {
    if (isContainerColour(ancestor.color)) return ancestor.color;
  }
  return null;
}