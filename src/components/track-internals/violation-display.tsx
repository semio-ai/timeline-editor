import {
  CSSProperties,
  Fragment,
  MutableRefObject,
  MouseEventHandler,
  type ReactNode,
  memo,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { clsx } from "clsx";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { motion, useTransform } from "motion/react";
import { closestFrame, PlayerActions, useDeepSelector, usePlayerStore } from "@semio/utils";
import { TrackedTooltip, useTrackedTooltip } from "@semio/ui";
import { uniq, clamp } from "lodash";
import { TIMELINE_PADDING } from "../../constants";
import {
  useAnimationStore,
  useZoomGestures,
  useTrackContext,
  usePairSprings,
  useColors,
} from "../../hooks";
import { ViolationSet, Violation, ViolationType } from "../../types";
import { AnimationData, AnimationActions } from "../../store-types";

export interface ViolationDisplayProps {
  violationSet: ViolationSet;
  ignoreZoom?: boolean;
}
function InnerViolationDisplay({
  violationSet,
  ignoreZoom = false,
}: ViolationDisplayProps): ReactNode {
  const trackIds = useMemo(
    () =>
      uniq(Object.keys(violationSet.violations).map((id) => violationSet.violations[id].trackId)),
    [violationSet],
  );

  const lookup: Record<string, { color: string; name: string }> = useAnimationStore(
    useDeepSelector((state: AnimationData) => {
      const l: Record<string, { color: string; name: string }> = {};
      trackIds.forEach((trackId: string) => {
        l[trackId] = {
          color:
            state.tracks[trackId]?.settings?.color ??
            state.animatables[state.tracks[trackId].animatableId]?.pub?.color ??
            "#737373",
          name: state.tracks[trackId]?.name ?? "Unknown Track",
        };
      });
      return l;
    }),
  );

  return (
    <g mask="url(#diagonalStripe)">
      {violationSet.segments.map((segment) => (
        <ViolationSegmentDisplay
          key={segment.id}
          segment={segment}
          violations={violationSet.violations}
          ignoreZoom={ignoreZoom}
          dataLookup={lookup}
        />
      ))}
    </g>
  );
}

interface ViolationSegmentDisplayProps {
  segment: {
    id: string;
    stampRange: { start: number; end: number };
    violations: string[];
  };
  violations: Record<string, Violation>;
  ignoreZoom: boolean;
  dataLookup: Record<string, { color: string; name: string }>;
}

function InnerViolationSegmentDisplay({
  segment,
  violations,
  dataLookup,
}: ViolationSegmentDisplayProps) {
  const rectRefOrig = useRef<SVGRectElement>(null);
  const floatingRefOrig = useRef<HTMLDivElement>(null);

  const updateHoverpointPreview = useAnimationStore(
    useShallow((state: AnimationActions) => state.updateHoverpointPreview),
  );

  const { xScale, zoomScale, bounds, frameCount, animationDuration } = useTrackContext();
  const { left, width } = usePairSprings(segment.stampRange.start, segment.stampRange.end, true);

  const resetPlayer = usePlayerStore(useShallow((state: PlayerActions) => state.resetPlayer));

  const { floatingStyles, elementRefs, context, updateHoverState } = useTrackedTooltip(
    rectRefOrig,
    floatingRefOrig,
    "top",
    "x",
    4,
  );

  const doubleClickHandler = useCallback(
    (event: MouseEvent) => {
      const newPosition = clamp(
        zoomScale.current.invert(((event.clientX ?? 0) - bounds.left) / bounds.width),
        0,
        1,
      );
      if (event.altKey) {
        resetPlayer(newPosition);
      } else {
        const closest: number = closestFrame(newPosition, frameCount);
        resetPlayer(closest);
      }
    },
    [bounds, frameCount, resetPlayer, zoomScale],
  );

  const uniqueTracks = useMemo(() => {
    return uniq(segment.violations.map((violationId) => violations[violationId].trackId));
  }, [segment, violations]);

  const color = useColors(uniqueTracks);

  useZoomGestures(rectRefOrig as MutableRefObject<EventTarget>, {
    onHover: ({ xy, hovering }) => {
      if (!hovering) {
        updateHoverpointPreview(null);
      }
      updateHoverState(...xy, hovering ?? false);
    },
    onMove: (state) => {
      const newPosition = zoomScale.current.invert(
        ((state.xy[0] || 0) - bounds.left) / bounds.width,
      );
      if (state.altKey) {
        updateHoverpointPreview(newPosition);
      } else {
        const closest: number = closestFrame(newPosition, frameCount);
        updateHoverpointPreview(closest);
      }
      updateHoverState(...state.xy, state.hovering ?? false);
    },
  });

  const x = useTransform(left, (ls) => xScale(ls * animationDuration));
  const w = useTransform(width, (ws) =>
    Math.max(0, xScale(ws * animationDuration) - TIMELINE_PADDING),
  );

  return (
    <>
      <TrackedTooltip
        ref={elementRefs.floatingRef}
        containerStyles={
          {
            ...floatingStyles,
            "--track-color": color,
          } as CSSProperties
        }
        open={context.open}
      >
        <div className="flex-col max-w-72">
          <div
            className={clsx(
              "px-2 py-1.5 bg-neutral-50/50 dark:bg-neutral-950/50",
              "text-(--track-color) flex-row flex justify-between items-center",
            )}
          >
            <div className="flex-row flex items-center">
              <IconAlertTriangle size={20} className="mr-2" />
              {uniqueTracks.length > 1 ? "Multiple Tracks" : dataLookup[uniqueTracks[0]].name}
            </div>
            <div className="bg-(--track-color) text-black min-w-6 text-center">
              {segment.violations.length}
            </div>
          </div>
          <div className="p-2 grid grid-cols-3 gap-2">
            {segment.violations.map((violationId) => {
              const sourceTrack = violations[violationId].trackId;
              const violationType = violations[violationId].type;
              return (
                <Fragment key={violationId}>
                  <div
                    key={`${violationId}-label`}
                    style={{ backgroundColor: dataLookup[sourceTrack].color }}
                    className="bg-opacity-25 text-black px-2 py-0.5"
                  >
                    {violationType === ViolationType.Upper && <span>Upper Limit</span>}
                    {violationType === ViolationType.Lower && <span>Lower Limit</span>}
                    {violationType === ViolationType.Velocity && <span>Velocity Limit</span>}
                    {violationType === ViolationType.Rate && <span>Rate Limit</span>}
                  </div>
                  <div key={`${violationId}-description`} className="col-span-2 text-wrap">
                    {uniqueTracks.length > 1 && (
                      <>
                        <span style={{ color: dataLookup[sourceTrack].color }}>
                          {dataLookup[sourceTrack].name}
                        </span>
                        <br />
                      </>
                    )}

                    {violationType === ViolationType.Upper && (
                      <span>Value exceeds upper bounds</span>
                    )}
                    {violationType === ViolationType.Lower && (
                      <span>Value exceeds lower bounds</span>
                    )}
                    {violationType === ViolationType.Velocity && (
                      <span>Value is changing faster than allowed by velocity limits</span>
                    )}
                    {violationType === ViolationType.Rate && (
                      <span>Value is updating faster than allowed by rate limits</span>
                    )}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      </TrackedTooltip>
      <motion.rect
        ref={elementRefs.triggerRef}
        x={x}
        onDoubleClick={doubleClickHandler as any as MouseEventHandler}
        width={w}
        y={0}
        fill={color}
        className={clsx("h-full opacity-50 hover:opacity-75")}
      />
    </>
  );
}

export const ViolationDisplay = memo(InnerViolationDisplay);
const ViolationSegmentDisplay = memo(InnerViolationSegmentDisplay);
