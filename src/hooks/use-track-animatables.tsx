import { useContext, createContext, ReactNode, useMemo } from "react";
import { AnimatableValue } from "@semio/data";
import { useShallow } from "zustand/shallow";
import { useAnimationStore } from "./use-animation-store";

/**
 * A color context, being a lookup of ids to the string versions of their colors.
 */
export type TrackAnimatableLookup = Record<string, AnimatableValue | undefined>;

export const TrackAnimatableContext = createContext<TrackAnimatableLookup>({});

export function TrackAnimatableContextProvider({ children }: { children: ReactNode }) {
  const [tracks, animatables] = useAnimationStore(
    useShallow((state) => [state.tracks, state.animatables]),
  );

  const nameMap = useMemo(() => {
    const trackAnimatables: TrackAnimatableLookup = Object.entries(
      tracks,
    ).reduce<TrackAnimatableLookup>((acc, [id, track]) => {
      acc[id] = animatables[track.animatableId];
      return acc;
    }, {});
    return trackAnimatables;
  }, [tracks, animatables]);

  return (
    <TrackAnimatableContext.Provider value={nameMap}>{children}</TrackAnimatableContext.Provider>
  );
}

/**
 * A hook that returns the color associated with a given ID or IDs.
 * If multiple IDs are provided, it returns the default color if they do not resolve to the same color.
 * @param idOrIds
 * @returns The color associated with the ID(s).
 */
export function useTrackAnimatable(trackId: string): AnimatableValue | undefined {
  const lookup = useContext(TrackAnimatableContext);
  if (!lookup) {
    throw new Error("useTrackAnimatable must be used within a TrackAnimatableProvider");
  }
  return lookup[trackId];
}

/**
 * A hook that returns the name lookup table
 */
export function useTrackAnimatableLookup(): TrackAnimatableLookup {
  const lookup = useContext(TrackAnimatableContext);
  if (!lookup) {
    throw new Error("useTrackAnimatableLookup must be used within a TrackAnimatableProvider");
  }
  return lookup;
}
