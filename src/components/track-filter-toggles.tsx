import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  ICON_CLASS_NAME,
  Eye,
  Speaker,
  Lock,
  ToggleSquare,
  Size,
} from "@semio/ui";
import { IconKey, IconSettings } from "@tabler/icons-react";
import { useAnimationStore } from "../hooks";
import type { AnimationActions, AnimationData } from "../store-types";

/**
 * Filter row toggle buttons:
 * 1. Mode toggle — switches track rows between key/skip and vis/mute/lock
 * 2. Global visibility — toggle visibility for all tracks (placeholder)
 * 3. Global mute — toggle mute for all tracks (placeholder)
 * 4. Global lock — toggle lock for all tracks (placeholder)
 */
export const TrackFilterToggles = memo(function TrackFilterToggles() {
  const controlStripMode = useAnimationStore(
    useShallow((state: AnimationData) => state.preferences.controlStripMode),
  );
  const setPreferences = useAnimationStore(
    useShallow((state: AnimationActions) => state.setPreferences),
  );

  const isProperties = controlStripMode === "properties";

  return (
    <>
      {/* Mode toggle */}
      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        label={isProperties ? "Show key controls" : "Show track properties"}
        value={isProperties}
        onChange={() =>
          setPreferences({ controlStripMode: isProperties ? "keySkip" : "properties" })
        }
      >
        {isProperties
          ? <IconSettings className={ICON_CLASS_NAME} />
          : <IconKey className={ICON_CLASS_NAME} />}
      </ToggleSquare>

      {/* Global visibility */}
      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        label="Toggle all visibility"
        value={false}
        onChange={() => {/* placeholder */}}
      >
        <Eye className={ICON_CLASS_NAME} size="100%" />
      </ToggleSquare>

      {/* Global mute */}
      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        label="Toggle all mute"
        value={false}
        onChange={() => {/* placeholder */}}
      >
        <Speaker className={ICON_CLASS_NAME} size="100%" />
      </ToggleSquare>

      {/* Global lock */}
      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        label="Toggle all lock"
        value={false}
        onChange={() => {/* placeholder */}}
      >
        <Lock className={ICON_CLASS_NAME} size="100%" />
      </ToggleSquare>
    </>
  );
});
