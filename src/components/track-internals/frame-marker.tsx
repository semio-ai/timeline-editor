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
import { animated, useSpringValue } from "@react-spring/web";
import { useShallow } from "zustand/react/shallow";
import { Theme, useTheme } from "@semio/ui";
import {
  useZoomGestures,
  useAnimationStore,
  useTrackContext,
  useStaticZoomedSpring,
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
  } = useTrackContext();

  const { resolvedTheme } = useTheme();

  const isSelected = usePlayerStore(
    useShallow((state) => trackIds.length > 0 && state.player.stamp === data.stamp),
  );

  const uniqueTracks = useMemo(() => uniq(data.points.map((p) => p.trackId)), [data.points]);

  const color = useAnimationStore(
    useShallow((state) => {
      if (uniqueTracks.length !== 1) return "#737373";
      return state.tracks[uniqueTracks[0]]?.settings?.color ?? "#737373";
    }),
  );

  const highlightColor = resolvedTheme === Theme.Dark ? "white" : "black";

  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const showLine = trackRender !== TrackRender.Key || dragging || isSelected || hovered;

  const hexStrokeColorSpring = useSpringValue<string>(isSelected ? highlightColor : "transparent", {
    config: { duration: 10 },
  });
  const lineStrokeWidth = useSpringValue<number>(showLine ? 1.5 : 0, {
    config: { duration: 10 },
  });

  useEffect(() => {
    void hexStrokeColorSpring.start({ to: isSelected ? highlightColor : "transparent" });
    void lineStrokeWidth.start({ to: showLine ? 1.5 : 0 });
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

  const updateKeypoint = useAnimationStore(useShallow((state) => state.updateKeypoint));

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

  const zoomedStamp = useStaticZoomedSpring(data.stamp, ignoreZoom);

  return (
    <animated.g
      ref={gestureRef as MutableRefObject<SVGGElement>}
      onDoubleClick={doubleClickHandler as any as MouseEventHandler}
      className="group/frame touch-none pointer-events-boundary"
      aria-selected={isSelected}
      style={{
        transform: zoomedStamp.to((zs) => `translateX(${xScale(zs).toString()}px`),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <animated.path d={linePath} fill="none" stroke={color} strokeWidth={lineStrokeWidth} />
      <animated.path d={hexPath} fill={color} stroke={hexStrokeColorSpring} strokeWidth={1} />
    </animated.g>
  );
}

export const FrameMarker = memo(InnerFrameMarker);
