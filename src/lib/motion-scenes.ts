export type MotionRole = "background" | "inline" | "onboarding";
export type MotionLoop = "once" | "loop" | "loop-with-pause";

export type MotionScene = {
  /** Stable id, kebab case. Never reused. */
  id: string;
  /** What the drawing is, in plain words. */
  name: string;
  /** Where it came from in the design file, frame and node. */
  source: string;
  /** Path to the component that renders it. */
  path: string;
  durationMs: number;
  loop: MotionLoop;
  /** Milliseconds held between loops, null when it does not pause. */
  pauseMs: number | null;
  role: MotionRole;
  /** Every place this renders today. Update this when you move it. */
  placement: string[];
};

/**
 * A new scene from the design file goes in `src/components/motion/`, gets an
 * entry here, and names every place it renders.
 */
export const MOTION_SCENES: MotionScene[] = [
  {
    id: "find-it-shimmer",
    name: "Conversations lighting up while the page looks through them",
    source: "Pass 200 · Find it · first attempt",
    path: "src/components/motion/ChatShimmer.tsx",
    durationMs: 2600,
    loop: "loop",
    pauseMs: null,
    role: "inline",
    placement: ["src/pages/FindItPage.tsx — while a run is going"],
  },
];
