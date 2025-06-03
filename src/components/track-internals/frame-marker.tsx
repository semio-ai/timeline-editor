import {
  type ReactNode,
  type MutableRefObject,
  type MouseEventHandler,
  memo,
  useMemo,
  useRef,
  useCallback,
  useState,
} from "react";
import {
  getHexagonPath,
  closestFrame,
  getDegenerateHexagonPath,
  usePlayerStore,
} from "@semio/utils";
import { clamp } from "lodash";
import { motion, useTransform } from "motion/react";
import { useShallow } from "zustand/react/shallow";
import { Theme, useTheme } from "@semio/ui";
import {
  useZoomGestures,
  useAnimationStore,
  useTrackContext,
  useScaleInverseSpring,
} from "../../hooks";
import { computeLocalStamp } from "../../functions";
import { DRAG_X_CONFIG } from "../../gesture-config";
import { InstancedFrameInfo, TrackRender } from "../../types";
import { useColors } from "../../hooks/use-colors";

export interface FrameMarkerProps {
  data: InstancedFrameInfo;
  ignoreZoom?: boolean;
}
function InnerFrameMarker({ data, ignoreZoom = false }: FrameMarkerProps): ReactNode {
  const gestureRef = useRef<SVGGElement>();
  const {
    frameCount,
    trackIds,
    instanceSettings,
    xScale,
    zoomScale,
    bounds: { width: timelineWidth, left: timelineLeft, height: timelineHeight },
    trackRender,
    animationDuration,
  } = useTrackContext();

  const { resolvedTheme } = useTheme();

  const isSelected = usePlayerStore(
    useShallow((state) => trackIds.length > 0 && state.player.stamp === data.stamp),
  );

  const color = useColors(data.points.map((p) => p.trackId));

  const [linePath, hexPath] = useMemo(() => {
    const lPath = getDegenerateHexagonPath(0, timelineHeight / 2, 12, timelineHeight);
    const hPath = getHexagonPath(0, timelineHeight / 2, 12, timelineHeight);
    return [lPath, hPath];
  }, [timelineHeight]);

  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const showLine = trackRender !== TrackRender.Key || dragging || isSelected || hovered;

  const [updateKeypoints, updateHoverpointPreview] = useAnimationStore(
    useShallow((state) => [state.updateKeypoints, state.updateHoverpointPreview]),
  );

  const resetPlayer = usePlayerStore(useShallow((state) => state.resetPlayer));

  const doubleClickHandler = useCallback(
    (event: MouseEvent) => {
      resetPlayer(data.stamp);
      event.stopPropagation();
    },
    [data.stamp, resetPlayer],
  );

  useZoomGestures(
    gestureRef as MutableRefObject<SVGGElement>,
    {
      onHover: (state) => {
        setHovered(state.hovering ?? false);
        if (!state.hovering) {
          updateHoverpointPreview(null);
        }
      },
      onMove: () => {
        updateHoverpointPreview(data.stamp);
      },
      onDrag: (state) => {
        const newPosition = zoomScale.current.invert(
          clamp(((state.xy[0] || 0) - timelineLeft) / timelineWidth, 0, 1),
        );
        const newStamp = state.shiftKey ? newPosition : closestFrame(newPosition, frameCount);
        const transformedStamp = computeLocalStamp(
          newStamp,
          instanceSettings.timescale,
          instanceSettings.offset,
        );
        // Bulk-update keypoints for all tracks/keys;
        updateKeypoints(
          data.points.map((p) => ({
            trackId: p.trackId,
            keypoint: { id: p.id, stamp: transformedStamp },
          })),
          !state.dragging,
        );
        setDragging(state.dragging ?? false);
        state.event.stopPropagation();
      },
    },
    DRAG_X_CONFIG,
  );

  const inverseScaleSpring = useScaleInverseSpring(ignoreZoom);
  const transformSpring = useTransform(inverseScaleSpring, (scaleSpring) => {
    return `translate(${xScale(data.stamp * animationDuration).toString()} 0) scale(${scaleSpring.toString()} 1)`;
  });

  transformSpring.on("change", (ts) => {
    gestureRef.current?.setAttribute("transform", ts);
  });

  return (
    <motion.g
      ref={gestureRef as MutableRefObject<SVGGElement>}
      onDoubleClick={doubleClickHandler as any as MouseEventHandler}
      className="group/frame touch-none pointer-events-boundary origin-left"
      aria-selected={isSelected}
      transform={transformSpring.get()}
    >
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        animate={showLine ? "withLine" : "withoutLine"}
        variants={{
          withLine: { strokeWidth: 1.5 },
          withoutLine: { strokeWidth: 0 },
        }}
        initial={{ strokeWidth: 0 }}
      />
      <motion.path
        d={hexPath}
        fill={color}
        initial={{ stroke: "transparent" }}
        variants={{
          selected: { stroke: resolvedTheme === Theme.Dark ? "white" : "black" },
          unselected: { stroke: "transparent" },
        }}
        animate={isSelected ? "selected" : "unselected"}
        strokeWidth={1}
      />
    </motion.g>
  );
}

export const FrameMarker = memo(InnerFrameMarker);
