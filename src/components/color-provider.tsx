import { createContext, ReactNode, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { useAnimationStore } from "../hooks";

/**
 * A color context, being a lookup of ids to the string versions of their colors.
 */
export interface ColorLookup extends Record<string, string> {
  default: string;
}

const DEFAULT_COLOR_MAP: ColorLookup = { default: "#737373" };

export const ColorContext = createContext<ColorLookup>(DEFAULT_COLOR_MAP);

export function ColorContextProvider({ children }: { children: ReactNode }) {
  const [tracks, animatables] = useAnimationStore(
    useShallow((state) => [state.tracks, state.animatables]),
  );

  const colorMap = useMemo(() => {
    const trackColors = Object.entries(tracks).reduce((acc, [id, track]) => {
      acc[id] = track.settings?.color || animatables[track.animatableId]?.pub?.color || "#737373";
      return acc;
    }, DEFAULT_COLOR_MAP);
    const animatableColors = Object.entries(animatables).reduce((acc, [id, animatable]) => {
      acc[id] = animatable.pub?.color || "#737373";
      return acc;
    }, trackColors);
    return animatableColors;
  }, [tracks, animatables]);

  return <ColorContext.Provider value={colorMap}>{children}</ColorContext.Provider>;
}
