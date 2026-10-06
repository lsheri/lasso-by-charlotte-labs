import { createContext, useContext } from "react";

/** True while the active act is in its teach beat; acts with timed playback hold until it clears. */
export const TourTeachBeatContext = createContext(false);

export function useTourTeachBeat(): boolean {
  return useContext(TourTeachBeatContext);
}
