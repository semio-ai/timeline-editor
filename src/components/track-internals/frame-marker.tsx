import {
  type ReactNode,
  type MutableRefObject,
  type MouseEventHandler,
  useMemo,
  memo,
  useRef,
  useCallback,
  useState,
  useEffect,
} from "react";
import { clsx } from "clsx";
import { getHexagonPath, closestFrame, getDegenerateHexagonPath } from "@semio/utils";
import { clamp, uniq } from "lodash";
import { animated, useSpringValue } from "@react-spring/web";
import { useShallow } from "zustand/react/shallow";
import { Theme, useTheme } from "@semio/ui";
import {
  useWithZoom,
  useZoomGestures,
  useAnimationStore,
  useTrackContext,
  useStaticZoomedSpring,
} from "../../hooks";
import { computeLocalStamp } from "../../functions";
import { DRAG_X_CONFIG } from "../../gesture-config";
import { Control, InstancedFrameInfo, TrackRender } from "../../types";

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
    instanceInfo,
    xScale,
    bounds: { width: timelineWidth, left: timelineLeft },
    trackRender,
  } = useTrackContext();

  const { resolvedTheme } = useTheme();

  const isSelected = useAnimationStore(
    useShallow((state) => trackIds.length > 0 && state.player.stamp === data.stamp),
  );

  const uniqueTracks = useMemo(() => uniq(data.points.map((p) => p.trackId)), [data.points]);

  const color = useAnimationStore(
    useShallow((state) => {
      if (uniqueTracks.length !== 1) return "#737373";
      return (
        Object.values(state.controls).find((c: Control) => c.writeId === uniqueTracks[0])?.settings
          ?.color ?? "#737373"
      );
    }),
  );

  const highlightColor = resolvedTheme === Theme.Dark ? "white" : "black";

  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const resolvedTrackRender = resolveRender(
    trackRender,
    trackIds.length,
    hovered || dragging || isSelected,
  );
  const showLine =
    resolvedTrackRender === TrackRender.Preview ||
    (trackRender === TrackRender.Preview && (dragging || isSelected || hovered));

  const pathSpring = useSpringValue<string>(
    resolvedTrackRender === TrackRender.Preview ? linePath : hexPath,
    {
      config: { duration: 10 },
    },
  );
  const hexStrokeColorSpring = useSpringValue<string>(isSelected ? highlightColor : "transparent", {
    config: { duration: 10 },
  });
  const lineStrokeWidth = useSpringValue<number>(showLine ? 1.5 : 0, {
    config: { duration: 10 },
  });

  useEffect(() => {
    void pathSpring.start({ to: resolvedTrackRender === TrackRender.Preview ? linePath : hexPath });
    void hexStrokeColorSpring.start({ to: isSelected ? highlightColor : "transparent" });
    void lineStrokeWidth.start({ to: showLine ? 1.5 : 0 });
  }, [
    resolvedTrackRender,
    showLine,
    color,
    highlightColor,
    isSelected,
    pathSpring,
    hexStrokeColorSpring,
    lineStrokeWidth,
  ]);

  const withZoom = useWithZoom(ignoreZoom);

  //const updateKeyframeStamp = useAnimationStore(useShallow((state) => state.updateKeyframeStamp));
  const updateKeypoint = useAnimationStore(useShallow((state) => state.updateKeypoint));

  const resetPlayer = useAnimationStore(useShallow((state) => state.resetPlayer));

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
        withZoom((zoomScale) => {
          const newPosition = zoomScale.invert(
            clamp(((state.xy[0] || 0) - timelineLeft) / timelineWidth, 0, 1),
          );
          const newStamp = state.shiftKey ? newPosition : closestFrame(newPosition, frameCount);
          const transformedStamp = computeLocalStamp(newStamp, instanceInfo);
          data.points.forEach((point) => {
            updateKeypoint(point.trackId, { ...point, stamp: transformedStamp });
          });
          setDragging(state.dragging ?? false);
          state.event.stopPropagation();
        });
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
      <animated.path
        d={pathSpring}
        fill={color}
        stroke={hexStrokeColorSpring}
        strokeWidth={1}
        className={
          clsx()
          // "group-hover:scale-x-100 group-aria-expanded:scale-x-100",
          // "scale-x-[15%]",
          // "transition-[fill,stroke]",
          // "group-hover/frame:dark:stroke-default-300 group-hover/frame:stroke-default-700",
          // "group-aria-selected/frame:dark:stroke-default-300",
          // "group-aria-selected/frame:stroke-default-700",
        }
      />
    </animated.g>
  );
}

export const FrameMarker = memo(InnerFrameMarker);

function resolveRender(
  renderType: TrackRender,
  trackCount: number,
  activity: boolean,
): TrackRender {
  if (renderType === TrackRender.Dope) {
    return renderType;
  }
  if (trackCount !== 1) {
    return TrackRender.Dope;
  }
  return activity ? TrackRender.Dope : renderType;
}
