import { useContext } from "react";
import { uniq } from "lodash";
import { ColorContext } from "../components/color-provider";

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
