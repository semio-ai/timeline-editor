import { useContext, createContext, ReactNode, useMemo } from "react";
import { uniq } from "lodash";
import { useShallow } from "zustand/shallow";
import { DEFAULT_COLOR } from "../constants";
import { useAnimationStore } from "./use-animation-store";

/**
 * A color context, being a lookup of ids to the string versions of their colors.
 */
export interface ColorLookup extends Record<string, string> {
  default: string;
}

const DEFAULT_COLOR_MAP: ColorLookup = { default: DEFAULT_COLOR };

export const ColorContext = createContext<ColorLookup>(DEFAULT_COLOR_MAP);

export function ColorContextProvider({ children }: { children: ReactNode }) {
  const [tracks, animatables] = useAnimationStore(
    useShallow((state) => [state.tracks, state.animatables]),
  );

  const colorMap = useMemo(() => {
    const trackColors = Object.entries(tracks).reduce((acc, [id, track]) => {
      acc[id] =
        track.settings?.color || animatables[track.animatableId]?.pub?.color || DEFAULT_COLOR;
      return acc;
    }, DEFAULT_COLOR_MAP);
    const animatableColors = Object.entries(animatables).reduce((acc, [id, animatable]) => {
      acc[id] = animatable.pub?.color || DEFAULT_COLOR;
      return acc;
    }, trackColors);
    return animatableColors;
  }, [tracks, animatables]);

  return <ColorContext.Provider value={colorMap}>{children}</ColorContext.Provider>;
}

/**
 * A hook that returns the color associated with a given ID or IDs.
 * If multiple IDs are provided, it returns the default color if they do not resolve to the same color.
 * @param idOrIds
 * @returns The color associated with the ID(s).
 */
export function useColors(idOrIds: string | string[]): string {
  const lookup = useContext(ColorContext);
  if (!lookup) {
    throw new Error("useColors must be used within a ColorProvider");
  }
  if (typeof idOrIds === "string") {
    return lookup[idOrIds] || lookup.default;
  } else {
    const allColors = uniq(idOrIds.map((id) => lookup[id] || lookup.default));
    return allColors.length === 1 ? allColors[0] : lookup.default;
  }
}
