import { memo, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Icon, KeyIcon, ToggleSquare, Size } from "@semio/ui";
import { useAnimationStore } from "../hooks";
import { collectSourceTracks } from "../functions/source-utils";
import { ControlStripMode } from "../store-types";
import type { AnimationActions, AnimationData } from "../store-types";

/**
 * Filter row toggle buttons:
 * 1. Mode toggle — switches track rows between key/skip and vis/mute/lock
 * 2. Global visibility — toggle visibility for all tracks
 * 3. Global mute — toggle mute for all tracks
 * 4. Global lock — toggle lock for all tracks
 *
 * Each button aggregates state from all leaf tracks in globalSourceTree:
 * - All on → true
 * - All off → false
 * - Mixed → "partial"
 *
 * Clicking partial sets all to the "on" state.
 */
export const TrackFilterToggles = memo(function TrackFilterToggles() {
  const controlStripMode = useAnimationStore(
    useShallow((state: AnimationData) => state.preferences.controlStripMode),
  );
  const setPreferences = useAnimationStore(
    useShallow((state: AnimationActions) => state.setPreferences),
  );
  const globalSourceTree = useAnimationStore(
    useShallow((state: AnimationData) => state.globalSourceTree),
  );
  const setTracksMuted = useAnimationStore(
    useShallow((state: AnimationActions) => state.setTracksMuted),
  );
  const setTracksVisible = useAnimationStore(
    useShallow((state: AnimationActions) => state.setTracksVisible),
  );
  const setTracksLocked = useAnimationStore(
    useShallow((state: AnimationActions) => state.setTracksLocked),
  );

  const isProperties = controlStripMode === ControlStripMode.Properties;

  // Collect all leaf tracks and compute aggregate states
  const { allIds, visibleState, mutedState, lockedState } = useMemo(() => {
    const tracks = collectSourceTracks(globalSourceTree);
    const ids = tracks.map((t) => t.id);

    if (ids.length === 0) {
      return {
        allIds: ids,
        visibleState: false as const,
        mutedState: false as const,
        lockedState: false as const,
      };
    }

    const allVisible = tracks.every((t) => t.visible !== false);
    const noneVisible = tracks.every((t) => t.visible === false);
    const visible: boolean | "partial" = allVisible ? true : noneVisible ? false : "partial";

    const allMuted = tracks.every((t) => t.muted);
    const noneMuted = tracks.every((t) => !t.muted);
    const muted: boolean | "partial" = allMuted ? true : noneMuted ? false : "partial";

    const allLocked = tracks.every((t) => t.locked);
    const noneLocked = tracks.every((t) => !t.locked);
    const locked: boolean | "partial" = allLocked ? true : noneLocked ? false : "partial";

    return { allIds: ids, visibleState: visible, mutedState: muted, lockedState: locked };
  }, [globalSourceTree]);

  const hasAnyTracks = allIds.length > 0;

  return (
    <>
      {/* Mode toggle */}
      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        label={isProperties ? "Show key controls" : "Show track properties"}
        value={isProperties}
        onChange={() =>
          setPreferences({
            controlStripMode: isProperties ? ControlStripMode.KeySkip : ControlStripMode.Properties,
          })
        }
      >
        {isProperties ? (
          <Icon name="settings" size="none" className="block w-3.5 h-3.5 shrink-0" />
        ) : (
          <KeyIcon fillOpacity={0} className="block w-3.5 h-3.5 shrink-0" />
        )}
      </ToggleSquare>

      {/* Global visibility */}
      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        label={visibleState === true ? "Hide all" : "Show all"}
        value={visibleState === "partial" ? "partial" : visibleState}
        disabled={!hasAnyTracks}
        onChange={() => {
          const next = visibleState === "partial" ? true : visibleState === true ? false : true;
          setTracksVisible(allIds, next);
        }}
      >
        {visibleState === false ? (
          <Icon name="eye-off" size="none" className="block w-3.5 h-3.5 shrink-0" />
        ) : (
          <Icon name="eye" size="none" className="block w-3.5 h-3.5 shrink-0" />
        )}
      </ToggleSquare>

      {/* Global mute */}
      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        label={mutedState === true ? "Unmute all" : "Mute all"}
        value={mutedState === "partial" ? "partial" : !(mutedState ?? false)}
        disabled={!hasAnyTracks}
        onChange={() => {
          const next = mutedState === "partial" ? true : !mutedState;
          setTracksMuted(allIds, next);
        }}
      >
        {mutedState === true ? (
          <Icon name="speaker-off" size="none" className="block w-3.5 h-3.5 shrink-0" />
        ) : (
          <Icon name="speaker" size="none" className="block w-3.5 h-3.5 shrink-0" />
        )}
      </ToggleSquare>

      {/* Global lock */}
      <ToggleSquare
        sizing="inner"
        size={Size.Xs}
        label={lockedState === true ? "Unlock all" : "Lock all"}
        value={lockedState === "partial" ? "partial" : !(lockedState ?? false)}
        disabled={!hasAnyTracks}
        onChange={() => {
          const next = lockedState === "partial" ? true : !lockedState;
          setTracksLocked(allIds, next);
        }}
      >
        {lockedState === true ? (
          <Icon name="lock" size="none" className="block w-3.5 h-3.5 shrink-0" />
        ) : (
          <Icon name="lock-off" size="none" className="block w-3.5 h-3.5 shrink-0" />
        )}
      </ToggleSquare>
    </>
  );
});
