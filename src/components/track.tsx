import type { ReactNode } from "react";
import { useMemo } from "react";
import useMeasure from "react-use-measure";
import { scaleLinear } from "@visx/scale";
import { useHover } from "@use-gesture/react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { pick } from "lodash";
import { RawValue } from "@semio/utils";
import { TIMELINE_PADDING } from "../constants";
import { TrackContext, useAnimationStore } from "../hooks";
import { AnimationData } from "../store-types";
import { computeVerticalBounds } from "../functions";
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

  // const viewport = useAnimationStore(useShallow((state: AnimationData) => state.player.viewport));

  const verticalBounds: [number, number] = useAnimationStore(
    useShallow((state: AnimationData) => {
      if (trackKeys.length !== 1 || trackRender === TrackRender.Dope) return [0, 1];
      const tracks = pick(state.tracks, trackKeys) as Record<string, TrackData<RawValue>>;
      const animatableValues = Object.values(state.controls)
        .filter((control: Control) => trackKeys.includes(control.writeId))
        .map((control: Control) => state.animatables[control.readId]);
      return computeVerticalBounds(tracks, animatableValues);
    }),
  );

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

  // const zoomScale = useMemo(
  //   () =>
  //     scaleLinear({
  //       domain: canZoom ? viewport : [0, 1],
  //       range: [0, 1],
  //     }),
  //   [viewport, canZoom],
  // );

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
        trackIds: trackKeys,
        bounds: activeRegionBounds,
        xScale,
        yScale,
        // zoomScale,
        frameCount,
        color,
        trackRender,
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
