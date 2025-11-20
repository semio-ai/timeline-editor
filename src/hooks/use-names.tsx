import { useContext, createContext, ReactNode, useMemo } from "react";
import { uniq } from "lodash";
import { useShallow } from "zustand/shallow";
import { useAnimationStore } from "./use-animation-store";

/**
 * A color context, being a lookup of ids to the string versions of their colors.
 */
export interface NameLookup extends Record<string, string> {
  default: string;
}

const DEFAULT_NAME_MAP: NameLookup = { default: "Unknown" };

export const NameContext = createContext<NameLookup>(DEFAULT_NAME_MAP);

export function NameContextProvider({ children }: { children: ReactNode }) {
  const [tracks, animatables] = useAnimationStore(
    useShallow((state) => [state.tracks, state.animatables]),
  );

  const nameMap = useMemo(() => {
    const trackNames = Object.entries(tracks).reduce((acc, [id, track]) => {
      acc[id] =
        track.name ||
        animatables[track.animatableId]?.name ||
        track.animatableId ||
        id ||
        "Unknown";
      return acc;
    }, DEFAULT_NAME_MAP);
    const animatableNames = Object.entries(animatables).reduce((acc, [id, animatable]) => {
      acc[id] = animatable.name || "Unknown";
      return acc;
    }, trackNames);
    return animatableNames;
  }, [tracks, animatables]);

  return <NameContext.Provider value={nameMap}>{children}</NameContext.Provider>;
}

/**
 * A hook that returns the color associated with a given ID or IDs.
 * If multiple IDs are provided, it returns the default color if they do not resolve to the same color.
 * @param idOrIds
 * @returns The color associated with the ID(s).
 */
export function useNames(idOrIds: string | string[], pluralDefault = "Multiple"): string {
  const lookup = useContext(NameContext);
  if (!lookup) {
    throw new Error("useNames must be used within a NameProvider");
  }
  if (typeof idOrIds === "string") {
    return lookup[idOrIds] || lookup.default;
  } else {
    const allColors = uniq(idOrIds.map((id) => lookup[id] || lookup.default));
    return allColors.length === 1 ? allColors[0] : pluralDefault;
  }
}

/**
 * A hook that returns the name lookup table
 */
export function useNameLookup(): NameLookup {
  const lookup = useContext(NameContext);
  if (!lookup) {
    throw new Error("useNameLookup must be used within a NameProvider");
  }
  return lookup;
}
