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

export type ContainersBand = "1" | "2-5" | "6-15" | "16+";

/** Banded count of a workspace's live containers. Never a judgement about a person. */
export function containersBand(n: number): ContainersBand {
  if (n <= 1) return "1";
  if (n <= 5) return "2-5";
  if (n <= 15) return "6-15";
  return "16+";
}