import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useThree, ThreeEvent } from "@react-three/fiber";
import { closestFrame, isOrthographicCamera } from "@semio/utils";
import { AnimationActions, AnimationData } from "../store-types";
import { useAltKeyPressed } from "./use-alt-key-pressed";
import { useAnimationStore } from "./use-animation-store";
import { usePlayer } from "./use-player";

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
 * const { playing } = usePlayer();
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
  const { size, camera } = useThree();

  // Player store actions and state
  const { resetPlayer, playing } = usePlayer(
    useShallow((state) => ({
      resetPlayer: state.resetPlayer,
      playing: state.player.running,
    })),
  );

  // Animation store state
  const { updateHoverpointPreview, framerate } = useAnimationStore(
    useShallow((state: AnimationData & AnimationActions) => ({
      updateHoverpointPreview: state.updateHoverpointPreview,
      framerate: state.framerate as number,
    })),
  );

  // Extract timeline position in ms from event
  const getTimelinePosition = useCallback(
    (event: PlaybackEvent): number => {
      if ("nativeEvent" in event) {
        // ThreeEvent - use intersection point for precise world coordinate (ms)
        const threeEvent = event as ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>;
        if (threeEvent.point) {
          return threeEvent.point.x;
        }
      }

      // Fallback: convert screen position to world space (ms)
      if (isOrthographicCamera(camera)) {
        const clientX =
          "nativeEvent" in event
            ? ((event as any).clientX ?? (event as any).nativeEvent?.clientX ?? 0)
            : (event as React.PointerEvent | React.MouseEvent).clientX;

        const normalizedX = clientX / size.width;
        return camera.left + normalizedX * (camera.right - camera.left);
      }

      return 0;
    },
    [size.width, camera],
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
        const closest = closestFrame(timelinePosition, framerate);
        resetPlayer(closest);
      }
    },
    [disabled, playing, getTimelinePosition, altPressed, resetPlayer, framerate],
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
        const closest = closestFrame(timelinePosition, framerate);
        updateHoverpointPreview(closest);
      }
    },
    [disabled, getTimelinePosition, altPressed, updateHoverpointPreview, framerate],
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
