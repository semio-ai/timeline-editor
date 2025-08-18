import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useThree, ThreeEvent } from "@react-three/fiber";
import { clamp } from "lodash";
import { closestFrame, usePlayerStore } from "@semio/utils";
import { AnimationActions, AnimationData } from "../store-types";
import { useAltKeyPressed } from "./use-alt-key-pressed";
import { useAnimationStore } from "./use-animation-store";

interface UsePlaybackGesturesOptions {
  disabled?: boolean;
}

type PlaybackEvent =
  | React.PointerEvent
  | React.MouseEvent
  | ThreeEvent<PointerEvent>
  | ThreeEvent<MouseEvent>;

interface UsePlaybackGesturesReturn {
  onDoubleClick: (event: PlaybackEvent) => void;
  onPointerMove: (event: PlaybackEvent) => void;
  onPointerEnter: (event: PlaybackEvent) => void;
  onPointerLeave: (event: PlaybackEvent) => void;
}

/**
 * Custom hook for handling playback gestures (double-click to seek, hover preview).
 * Uses world coordinates which work across all areas of the canvas-sheet component.
 *
 * This hook provides unified gesture handling for timeline interactions across different
 * areas of the canvas-sheet component, including the main canvas, rulers, minimap, and HUD sections.
 *
 * @param options Configuration options
 * @param options.disabled - Whether to disable all gesture handling
 * @returns Object with gesture event handlers to be spread onto target elements
 *
 * @example
 * // Basic usage
 * const gestures = usePlaybackGestures();
 * return <mesh {...gestures} />;
 *
 * @example
 * // Conditional disabling during playback
 * const { playing } = usePlayerStore();
 * const gestures = usePlaybackGestures({ disabled: playing });
 *
 * Features:
 * - Double-click to seek: Sets playhead to clicked position
 * - Hover preview: Shows preview position while hovering
 * - Alt key support: Precise positioning vs frame snapping
 * - World coordinates: Works across all canvas areas
 * - Automatic frame calculation: Uses current framerate and duration
 * - Cross-event compatibility: Handles both ThreeEvent (R3F) and React events
 * - Non-blocking: Does not stop event propagation for inner element interactions
 */
export const usePlaybackGestures = ({
  disabled = false,
}: UsePlaybackGesturesOptions = {}): UsePlaybackGesturesReturn => {
  const altPressed = useAltKeyPressed();
  const { size } = useThree();

  // Player store actions and state
  const { resetPlayer, playing, playerDuration } = usePlayerStore(
    useShallow((state) => ({
      resetPlayer: state.resetPlayer,
      playing: state.player.running,
      playerDuration: state.player.duration,
    })),
  );

  // Animation store state
  const { updateHoverpointPreview, framerate } = useAnimationStore(
    useShallow((state: AnimationData & AnimationActions) => ({
      updateHoverpointPreview: state.updateHoverpointPreview,
      framerate: state.framerate as number,
    })),
  );

  // Calculate frame count
  const frameCount = useMemo(() => {
    return Math.floor(framerate * (playerDuration / 1000));
  }, [framerate, playerDuration]);

  // Extract timeline position from event
  const getTimelinePosition = useCallback(
    (event: PlaybackEvent): number => {
      if ("nativeEvent" in event) {
        // ThreeEvent - use intersection point for precise world coordinate
        const threeEvent = event as ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>;
        if (threeEvent.point) {
          // The mesh spans 0-1 in world coordinates, so x coordinate is timeline position
          return clamp(threeEvent.point.x, 0, 1);
        }
      }

      // Fallback for regular React events or ThreeEvents without intersection data
      // Convert screen position to normalized coordinate and assume 0-1 mapping
      const clientX =
        "nativeEvent" in event
          ? ((event as any).clientX ?? (event as any).nativeEvent?.clientX ?? 0)
          : (event as React.PointerEvent | React.MouseEvent).clientX;

      const normalizedX = clientX / size.width;
      return clamp(normalizedX, 0, 1);
    },
    [size.width],
  );

  // Double click handler
  const onDoubleClick = useCallback(
    (event: PlaybackEvent) => {
      if (disabled || playing) return; // Ignore double clicks while playing

      const timelinePosition = getTimelinePosition(event);

      if (altPressed) {
        // Alt key: set precise position
        resetPlayer(timelinePosition);
      } else {
        // No alt key: snap to closest frame
        const closest = closestFrame(timelinePosition, frameCount);
        resetPlayer(closest);
      }
    },
    [disabled, playing, getTimelinePosition, altPressed, resetPlayer, frameCount],
  );

  // Pointer move handler
  const onPointerMove = useCallback(
    (event: PlaybackEvent) => {
      if (disabled) return;

      const timelinePosition = getTimelinePosition(event);

      if (altPressed) {
        // Alt key: show precise position
        updateHoverpointPreview(timelinePosition);
      } else {
        // No alt key: snap to closest frame
        const closest = closestFrame(timelinePosition, frameCount);
        updateHoverpointPreview(closest);
      }
    },
    [disabled, getTimelinePosition, altPressed, updateHoverpointPreview, frameCount],
  );

  // Pointer enter handler
  const onPointerEnter = useCallback(
    (event: PlaybackEvent) => {
      if (disabled) return;
      // Trigger initial hover preview
      onPointerMove(event);
    },
    [disabled, onPointerMove],
  );

  // Pointer leave handler
  const onPointerLeave = useCallback(
    (_event: PlaybackEvent) => {
      if (disabled) return;
      // Clear hover preview
      updateHoverpointPreview(null);
    },
    [disabled, updateHoverpointPreview],
  );

  return {
    onDoubleClick,
    onPointerMove,
    onPointerEnter,
    onPointerLeave,
  };
};
