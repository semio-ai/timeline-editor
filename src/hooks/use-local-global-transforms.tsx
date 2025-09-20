import { useContext, createContext, ReactNode, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { computeLocalStamp, computeWorldStamp } from "../functions";
import { useAnimationStore } from "./use-animation-store";

/**
 * A color context, being a lookup of ids to the string versions of their colors.
 */
export interface LocalGlobalTransformLookup {
  toWorld: Record<string, (stamp: number) => number>;
  toLocal: Record<string, (stamp: number) => number>;
}

const DEFAULT_LOCAL_GLOBAL_LOOKUP: LocalGlobalTransformLookup = { toWorld: {}, toLocal: {} };

export const LocalGlobalTransformContext = createContext<LocalGlobalTransformLookup>(
  DEFAULT_LOCAL_GLOBAL_LOOKUP,
);

export function LocalGlobalTransformContextProvider({ children }: { children: ReactNode }) {
  const namespaces = useAnimationStore(useShallow((state) => state.namespaces));

  const transformLookup = useMemo(() => {
    const toWorld: Record<string, (stamp: number) => number> = {};
    const toLocal: Record<string, (stamp: number) => number> = {};

    Object.values(namespaces).forEach((namespace) => {
      Object.values(namespace.animationInstances).forEach((instance) => {
        const toWorldFunc = (stamp: number) =>
          computeWorldStamp(stamp, instance.settings.timescale, instance.settings.offset);
        const toLocalFunc = (stamp: number) =>
          computeLocalStamp(stamp, instance.settings.timescale, instance.settings.offset);
        toWorld[instance.id] = toWorldFunc;
        toLocal[instance.id] = toLocalFunc;
      });
    });

    return { toWorld, toLocal };
  }, [namespaces]);

  return (
    <LocalGlobalTransformContext.Provider value={transformLookup}>
      {children}
    </LocalGlobalTransformContext.Provider>
  );
}

/**
 * A hook that returns the color associated with a given ID or IDs.
 * If multiple IDs are provided, it returns the default color if they do not resolve to the same color.
 * @param idOrIds
 * @returns The color associated with the ID(s).
 */
export function useLocalGlobalTransform(
  instanceId: string,
  direction: "toLocal" | "toWorld",
): (stamp: number) => number {
  const lookup = useContext(LocalGlobalTransformContext);
  if (!lookup) {
    throw new Error("useNames must be used within a NameProvider");
  }
  return lookup[direction][instanceId];
}

/**
 * A hook that returns the name lookup table
 */
export function useLocalGlobalTransformLookup(): LocalGlobalTransformLookup {
  const lookup = useContext(LocalGlobalTransformContext);
  if (!lookup) {
    throw new Error("useNameLookup must be used within a NameProvider");
  }
  return lookup;
}
