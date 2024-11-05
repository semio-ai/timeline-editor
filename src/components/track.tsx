import type { ReactNode } from "react";
import { useMemo, useRef } from "react";
import useMeasure from "react-use-measure";
import { scaleLinear } from "@visx/scale";
import { useHover } from "@use-gesture/react";
import { useShallow } from "zustand/react/shallow";
import { shallow } from "zustand/shallow";
import { clsx } from "clsx";
import { pick } from "lodash";
import { AnimatableValue, RawValue } from "@semio/utils";
import { TIMELINE_PADDING } from "../constants";
import { TrackContext, useAnimationStore, usePlayerSubscription } from "../hooks";
import { AnimationData } from "../store-types";
import { computeVerticalBounds } from "../functions";
import { ScaleLinear } from "../scale-linear";
import { Track as TrackData, InstanceInfo, Control, TrackRender } from "../types";
import {
  Playhead,
  HoverMarker,
  BoundsDisplay,
  GestureDetector,
  DataDisplay,
  TrackBackground,
  ZoomDisplay,
} from "./track-internals";

export interface TrackProps {
  width: number;
  animationId: string;
  namespaceId: string;
  trackIds?: string[];
  attribute?: string;
  canZoom?: boolean;
  trackRender: TrackRender;
  showBackground?: boolean;
  showData?: boolean;
  showZoomControls?: boolean;
  useCustomColor?: boolean;
  color?: string;
  emphasis?: boolean;
  onEmphasisChange?: (emphasis: boolean) => void;
}

/**
 * Track component that renders the background, data, and zoom controls for a single animation.
 * @param width - The width of the track.
 * @param animationId - The ID of the animation.
 * @param namespaceId - The namespace of the animation.
 * @param trackIds - The IDs of the tracks to display.
 * @param attribute - The attribute to display, used with complex datatypes.
 * @param canZoom - Whether the track can be zoomed.
 * @param trackRender - The render type for the track (degrades to Dope if multiple tracks are present).
 * @param showBackground - Whether to show the background.
 * @param showData - Whether to show the data.
 * @param showZoomControls - Whether to show the zoom controls.
 * @param emphasis - Whether the track is in an emphasized state.
 * @param color - The color of the track.
 * @param onEmphasisChange - Callback for when the emphasis state changes.
 */
export function Track({
  width,
  animationId,
  namespaceId,
  trackIds,
  attribute,
  trackRender,
  canZoom = true,
  showData = true,
  showBackground = true,
  showZoomControls = false,
  emphasis = false,
  color = "#737373",
  onEmphasisChange,
}: TrackProps): ReactNode {
  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );
  const duration = useAnimationStore(
    useShallow((state: AnimationData) => state.animations[animationId]?.duration ?? 5000),
  );

  const instanceInfo: InstanceInfo = useAnimationStore(
    useShallow((state: AnimationData) => state.animations[animationId]?.instances[namespaceId]),
  );

  const trackKeys = useAnimationStore(
    useShallow((state: AnimationData) =>
      (trackIds ?? []).length > 0 ? (trackIds ?? []) : state.animations[animationId]?.tracks,
    ),
  );

  const tracks = useAnimationStore(
    useShallow((state: AnimationData) => pick(state.tracks, trackKeys)),
  ) as Record<string, TrackData<RawValue>>;

  // const viewport = useAnimationStore(useShallow((state: AnimationData) => state.player.viewport));
  const [allControls, allAnimatables] = useAnimationStore(
    useShallow((state: AnimationData) => [state.controls, state.animatables]),
  );

  const verticalBounds = useMemo(() => {
    if (
      trackKeys.length !== 1 ||
      trackRender === TrackRender.Dope ||
      trackRender === TrackRender.Transition
    )
      return [0, 1];
    const animatableValues = Object.values(allControls)
      .filter((control: Control) => trackKeys.includes(control.writeId))
      .map((control: Control) => allAnimatables[control.readId]);
    return computeVerticalBounds(tracks, animatableValues, attribute);
  }, [trackKeys, trackRender, tracks, allControls, allAnimatables, attribute]);

  const trackType = useMemo(() => {
    if (trackKeys.length !== 1) {
      const types = new Set<AnimatableValue["type"]>();
      Object.values(allControls)
        .filter((control: Control) => trackKeys.includes(control.writeId))
        .forEach((control: Control) =>
          types.add(allAnimatables[control.readId].type as AnimatableValue["type"]),
        );
      return types.size === 1
        ? types.values().next().value!
        : ("multiple" as AnimatableValue["type"] | "multiple");
    } else {
      const control = Object.values(allControls).find((c: Control) => trackKeys[0] === c.writeId);
      if (!control) return "multiple";

      return allAnimatables[control.readId].type;
    }
  }, [allAnimatables, allControls, trackKeys]);

  const resolvedRender = useMemo(() => {
    if (trackKeys.length !== 1) return TrackRender.Dope;
    if (trackType === "number") return trackRender;
    if (attribute && ["vector3", "euler", "rgb", "hsl"].includes(trackType)) return trackRender;
    return TrackRender.Dope;
  }, [trackKeys, trackRender, trackType, attribute]);

  const frameCount = Math.floor(framerate * (duration / 1000));

  const [activeRegionRef, activeRegionBounds] = useMeasure();

  const xScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, 1],
        range: [TIMELINE_PADDING, width - TIMELINE_PADDING],
      }),
    [width],
  );

  const yScale = useMemo(
    () => scaleLinear({ domain: verticalBounds, range: [28, 2] }),
    [verticalBounds],
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
    if (onEmphasisChange) {
      onEmphasisChange(hovering);
    }
  });

  return (
    <TrackContext.Provider
      value={{
        animationId,
        namespaceId,
        instanceInfo,
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
        className={clsx("relative h-[30px] w-full group/track", emphasis && "has-emphasis")}
      >
        <svg
          height={30}
          className="touch-none fill-transparent w-full"
          width={width < 0 ? 0 : width}
        >
          <rect
            ref={activeRegionRef}
            x={xScale(0)}
            width={Math.max(0, width - TIMELINE_PADDING * 2)}
            className="h-[30px]"
          />
          <TrackBackground
            animationId={animationId}
            showLine={canZoom && showBackground}
            ignoreZoom={!canZoom}
            tickHeight={30}
            showTicks={canZoom}
            trackIds={trackIds}
          />

          {/* Gesture Detector */}
          <GestureDetector ignoreZoom={!canZoom} />

          <BoundsDisplay ignoreZoom={!canZoom} />
          <HoverMarker ignoreZoom={!canZoom} />
          {!canZoom && <ZoomDisplay />}

          <Playhead ignoreZoom={showZoomControls} />

          {showData && <DataDisplay ignoreZoom={!canZoom} />}
        </svg>
      </div>
    </TrackContext.Provider>
  );
}
