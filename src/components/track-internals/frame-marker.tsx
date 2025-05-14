import {
  type ReactNode,
  type MutableRefObject,
  type MouseEventHandler,
  memo,
  useMemo,
  useRef,
  useCallback,
  useState,
  useEffect,
} from "react";
import {
  getHexagonPath,
  closestFrame,
  getDegenerateHexagonPath,
  usePlayerStore,
} from "@semio/utils";
import { clamp, uniq } from "lodash";
import { motion, useSpring, useTransform } from "motion/react";
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

const linePath = getDegenerateHexagonPath(0, 15, 12, 30);
const hexPath = getHexagonPath(0, 15, 12, 30);

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
    bounds: { width: timelineWidth, left: timelineLeft },
    trackRender,
    animationDuration,
  } = useTrackContext();

  const { resolvedTheme } = useTheme();

  const isSelected = usePlayerStore(
    useShallow((state) => trackIds.length > 0 && state.player.stamp === data.stamp),
  );

  const uniqueTracks = useMemo(() => uniq(data.points.map((p) => p.trackId)), [data.points]);

  const color = useAnimationStore(
    useShallow((state) => {
      if (uniqueTracks.length !== 1) return "#737373";
      return state.tracks[uniqueTracks[0]]?.settings?.color ?? "var(--track-color)";
    }),
  );

  const highlightColor = resolvedTheme === Theme.Dark ? "white" : "black";

  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const showLine = trackRender !== TrackRender.Key || dragging || isSelected || hovered;

  const hexStrokeColorSpring = useSpring(isSelected ? highlightColor : "transparent");
  const lineStrokeWidth = useSpring(showLine ? 1.5 : 0);

  useEffect(() => {
    hexStrokeColorSpring.set(isSelected ? highlightColor : "transparent");
    lineStrokeWidth.jump(showLine ? 1.5 : 0);
  }, [
    trackRender,
    showLine,
    color,
    highlightColor,
    isSelected,
    hexStrokeColorSpring,
    lineStrokeWidth,
    dragging,
    hovered,
  ]);

  const [updateKeypoint, updateHoverpointPreview] = useAnimationStore(
    useShallow((state) => [state.updateKeypoint, state.updateHoverpointPreview]),
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
        data.points.forEach((point) => {
          updateKeypoint(point.trackId, { ...point, stamp: transformedStamp });
        });
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
      <motion.path d={linePath} fill="none" stroke={color} strokeWidth={lineStrokeWidth} />
      <motion.path d={hexPath} fill={color} stroke={hexStrokeColorSpring} strokeWidth={1} />
    </motion.g>
  );
}

export const FrameMarker = memo(InnerFrameMarker);
