import type { ReactNode } from "react";
import { useMemo, useRef } from "react";
import useMeasure from "react-use-measure";
import { scaleLinear } from "@visx/scale";
import { useHover } from "@use-gesture/react";
import { useShallow } from "zustand/react/shallow";
import { shallow } from "zustand/shallow";
import { clsx } from "clsx";
import { pick } from "lodash";
import { AnimatableValue, RawValue, usePlayerStore } from "@semio/utils";
import { TIMELINE_PADDING } from "../constants";
import { TrackContext, useAnimationStore, usePlayerSubscription, useColors } from "../hooks";
import { AnimationData } from "../store-types";
import { computeVerticalBounds } from "../functions";
import { ScaleLinear } from "../scale-linear";
import { Track as TrackData, TrackRender, AnimationInstanceSettings } from "../types";
import {
  Playhead,
  HoverMarker,
  BoundsDisplay,
  GestureDetector,
  DataDisplay,
  TrackBackground,
  ZoomDisplay,
} from "./track-internals";

export interface TrackVisualizerProps {
  width: number;
  height?: number;
  animationId: string;
  namespaceId: string;
  instanceSettings: AnimationInstanceSettings;
  trackIds?: string[];
  attribute?: string;
  canZoom?: boolean;
  trackRender: TrackRender;
  showData?: boolean;
  showZoomControls?: boolean;
  showBackground?: boolean;
  useCustomColor?: boolean;
  showFullLine?: boolean;
  highlighted?: boolean;
  onHighlightChange?: (highlight: boolean) => void;
}

/**
 * Track component that renders the background, data, and zoom controls for a single animation.
 * @param width - The width of the track.
 * @param height - The height of the track (default is 30px).
 * @param animationId - The ID of the animation.
 * @param namespaceId - The namespace of the animation.
 * @param instanceSettings - The offset/timescale information
 * @param trackIds - The IDs of the tracks to display.
 * @param attribute - The attribute to display, used with complex datatypes.
 * @param canZoom - Whether the track can be zoomed.
 * @param trackRender - The render type for the track (degrades to Dope if multiple tracks are present).
 * @param showData - Whether to show the data.
 * @param showZoomControls - Whether to show the zoom controls.
 * @param showFullLine - Whether to show the full line when rendering with TrackRender.Line
 * @param highlighted - Whether the track is in an emphasized state.
 * @param onHighlightChange - Callback for when the emphasis state changes.
 */
export function TrackVisualizer({
  width,
  height = 32,
  animationId,
  instanceSettings,
  trackIds,
  attribute,
  trackRender,
  canZoom = true,
  showData = true,
  showFullLine = false,
  showZoomControls = false,
  showBackground = true,
  highlighted = false,
  onHighlightChange,
}: TrackVisualizerProps): ReactNode {
  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );

  const color = useColors(trackIds ?? []);

  const playerDuration = usePlayerStore(useShallow((state) => state.player.duration));

  const animationDuration = useAnimationStore(
    useShallow((state: AnimationData) => state.animations[animationId]?.duration ?? 5000),
  );

  const trackKeys = useAnimationStore(
    useShallow((state: AnimationData) =>
      (trackIds ?? []).length > 0 ? (trackIds ?? []) : state.animations[animationId]?.tracks,
    ),
  );

  const tracks = useAnimationStore(
    useShallow((state: AnimationData) => pick(state.tracks, trackKeys)),
  ) as Record<string, TrackData<RawValue>>;

  const animatableIds = Object.values(tracks || {}).map((track) => track.animatableId);

  const [allAnimatables] = useAnimationStore(
    useShallow((state: AnimationData) => [state.animatables]),
  );

  const verticalBounds = useMemo(() => {
    if (
      trackKeys.length !== 1 ||
      trackRender === TrackRender.Key ||
      trackRender === TrackRender.Transition
    )
      return [0, 1];

    const sources = Object.values(tracks).map((track) => {
      const animatable = allAnimatables[track.animatableId];
      if (attribute && ["vector3", "vector2", "euler", "rgb", "hsl"].includes(animatable.type)) {
        return { trackId: track.id, type: animatable.type, attribute };
      } else {
        return { trackId: track.id, type: animatable.type };
      }
    });

    return computeVerticalBounds(tracks, allAnimatables, sources);
  }, [trackKeys.length, trackRender, allAnimatables, tracks, attribute]);

  const trackType = useMemo(() => {
    const types = new Set<AnimatableValue["type"]>();
    animatableIds.forEach((id) => types.add(allAnimatables[id]?.type as AnimatableValue["type"]));

    return types.size === 1
      ? types.values().next().value!
      : ("multiple" as AnimatableValue["type"] | "multiple");
  }, [allAnimatables, animatableIds]);

  const resolvedRender = useMemo(() => {
    if (trackKeys.length !== 1) return TrackRender.Key;
    if (trackType === "number") return trackRender;
    if (attribute && ["vector3", "vector2", "euler", "rgb", "hsl"].includes(trackType))
      return trackRender;
    return TrackRender.Key;
  }, [trackKeys, trackRender, trackType, attribute]);

  const frameCount = Math.floor(framerate * (animationDuration / 1000));

  const [activeRegionRef, activeRegionBounds] = useMeasure();

  const xScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, playerDuration],
        range: [TIMELINE_PADDING, width - TIMELINE_PADDING],
      }),
    [width, playerDuration],
  );

  const yScale = useMemo(
    () => scaleLinear({ domain: verticalBounds, range: [height - 2, 2] }),
    [verticalBounds, height],
  );

  const zoomScale = useRef<ScaleLinear>(scaleLinear({ domain: [0, 1], range: [0, 1] }));

  usePlayerSubscription(
    (state) => state.player.viewport,
    (viewport) => {
      zoomScale.current.domain(viewport);
    },
    shallow,
  );

  const bind = useHover(({ hovering: h }) => {
    const hovering = h ?? false;
    onHighlightChange?.(hovering);
  });

  return (
    <TrackContext.Provider
      value={{
        animationId,
        instanceSettings,
        animationDuration,
        attribute,
        trackIds: trackKeys,
        bounds: activeRegionBounds,
        xScale,
        yScale,
        zoomScale,
        frameCount,
        color,
        trackRender: resolvedRender,
        trackType,
      }}
    >
      <div
        {...bind()}
        data-highlighted={highlighted ? "" : undefined}
        className={clsx("relative w-full group/track focus:outline-none")}
        style={{ height }}
      >
        <svg
          height={height}
          className="touch-none fill-transparent w-full"
          width={width < 0 ? 0 : width}
        >
          <rect
            ref={activeRegionRef}
            x={xScale(0)}
            width={Math.max(0, width - TIMELINE_PADDING * 2)}
            height={height}
          />
          <TrackBackground
            ignoreZoom={!canZoom}
            tickHeight={height}
            showTicks={canZoom}
            showBackground={showBackground}
          />

          {/* Gesture Detector */}
          <GestureDetector ignoreZoom={!canZoom} />

          <BoundsDisplay ignoreZoom={!canZoom} />
          <HoverMarker ignoreZoom={!canZoom} />
          {!canZoom && <ZoomDisplay />}

          <Playhead ignoreZoom={showZoomControls} />

          {showData && <DataDisplay ignoreZoom={!canZoom} showFullLine={showFullLine} />}
        </svg>
      </div>
    </TrackContext.Provider>
  );
}
