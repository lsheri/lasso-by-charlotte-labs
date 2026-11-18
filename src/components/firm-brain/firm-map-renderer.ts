import type { FirmMapLayout } from "@/lib/firm-map-shared";

/**
 * The renderer boundary for the firm map. The 3D map and the flat map both take exactly these props and draw only
 * what the layout holds; all state lives in FirmBrainMap, so swapping a renderer changes nothing about what is pulled,
 * read or gated.
 */
export type FirmMapRendererProps = {
  layout: FirmMapLayout;
  /** Pulled threads, or null when nothing is pulled. */
  lit: Set<string> | null;
  /** Points on a pulled thread, or null when nothing is pulled. */
  litNodes: Set<string> | null;
  /** The point the reading panel describes. */
  selected: string | null;
  reduceMotion: boolean;
  /** Bumped by the Replay button; each new value sews the threads again in date order. Ignored under reduced motion. */
  replayKey: number;
  replayDelays: Map<string, number>;
  onHover: (nodeId: string | null) => void;
  onPick: (nodeId: string | null) => void;
  /** The renderer could not start (no WebGL context after all, a lost context): the map falls back without an error. */
  onFail?: () => void;
};

/** How long one thread takes to sew on Replay. */
export const SEW_MS = 1500;
