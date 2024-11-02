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
import { animated } from "@react-spring/web";
import { closestFrame, useDeep } from "@semio/utils";
import { TrackedTooltip, useTrackedTooltip } from "@semio/ui";
import { uniq, clamp } from "lodash";
import { TIMELINE_PADDING } from "../../constants";
import {
  useAnimationStore,
  useZoomGestures,
  useTrackContext,
  usePairSprings,
  useHoverSpring,
  useWithZoom,
} from "../../hooks";
import { ViolationSet, Violation, ViolationType, Control } from "../../types";
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
    useDeep((state: AnimationData) => {
      const l: Record<string, { color: string; name: string }> = {};
      trackIds.forEach((trackId: string) => {
        const control = Object.values(state.controls).find(
          (ctrl: Control) => ctrl.writeId === trackId,
        );
        if (control) {
          l[trackId] = {
            color: control.settings.color ?? "#737373",
            name: state.tracks[trackId]?.name ?? "Unknown Track",
          };
        }
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
  ignoreZoom,
  dataLookup,
}: ViolationSegmentDisplayProps) {
  const rectRefOrig = useRef<SVGRectElement>(null);
  const floatingRefOrig = useRef<HTMLDivElement>(null);

  const { xScale, bounds, frameCount, color: defaultTrackColor } = useTrackContext();
  const { left, width } = usePairSprings(
    segment.stampRange.start,
    segment.stampRange.end,
    ignoreZoom,
  );
  const { setHoverpoint, clearHoverpoint } = useHoverSpring(ignoreZoom);
  const withZoom = useWithZoom(ignoreZoom);
  const resetPlayer = useAnimationStore(useShallow((state: AnimationActions) => state.resetPlayer));

  const { floatingStyles, elementRefs, context, updateHoverState } = useTrackedTooltip(
    rectRefOrig,
    floatingRefOrig,
    "top",
    "x",
    4,
  );

  const doubleClickHandler = useCallback(
    (event: MouseEvent) => {
      withZoom((zoomScale) => {
        const newPosition = clamp(
          zoomScale.invert(((event.clientX ?? 0) - bounds.left) / bounds.width),
          0,
          1,
        );
        if (event.altKey) {
          resetPlayer(newPosition);
        } else {
          const closest: number = closestFrame(newPosition, frameCount);
          resetPlayer(closest);
        }
      });
    },
    [bounds, frameCount, resetPlayer, withZoom],
  );

  const [uniqueTracks, color] = useMemo(() => {
    const uniqueTracksSet = uniq(
      segment.violations.map((violationId) => violations[violationId].trackId),
    );
    const size = uniqueTracksSet.length;
    if (size === 0 || size > 1) {
      return [uniqueTracksSet, defaultTrackColor];
    } else {
      return [uniqueTracksSet, dataLookup[uniqueTracksSet[0]].color];
    }
  }, [dataLookup, defaultTrackColor, segment, violations]);

  useZoomGestures(rectRefOrig as MutableRefObject<EventTarget>, {
    onHover: ({ xy, hovering }) => {
      if (!hovering) {
        clearHoverpoint();
      }
      updateHoverState(...xy, hovering ?? false);
    },
    onMove: (state) => {
      withZoom((zoomScale) => {
        const newPosition = zoomScale.invert(((state.xy[0] || 0) - bounds.left) / bounds.width);
        if (state.altKey) {
          setHoverpoint(newPosition);
        } else {
          const closest: number = closestFrame(newPosition, frameCount);
          setHoverpoint(closest);
        }
        updateHoverState(...state.xy, state.hovering ?? false);
      });
    },
  });

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
              "text-[--track-color] flex-row flex justify-between items-center",
            )}
          >
            <div className="flex-row flex items-center">
              <IconAlertTriangle size={20} className="mr-2" />
              {uniqueTracks.length > 1 ? "Multiple Tracks" : dataLookup[uniqueTracks[0]].name}
            </div>
            <div className="bg-[--track-color] text-black min-w-6 text-center">
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
      <animated.rect
        ref={elementRefs.triggerRef}
        x={left.to((ls) => xScale(ls))}
        onDoubleClick={doubleClickHandler as any as MouseEventHandler}
        width={width.to((ws) => Math.max(0, xScale(ws) - TIMELINE_PADDING))}
        y={0}
        fill={color}
        className={clsx("h-full opacity-50 hover:opacity-75")}
      />
    </>
  );
}

export const ViolationDisplay = memo(InnerViolationDisplay);
const ViolationSegmentDisplay = memo(InnerViolationSegmentDisplay);
