import { CSSProperties, MutableRefObject, type ReactNode, memo, useRef } from "react";
import { clsx } from "clsx";
import { animated } from "@react-spring/web";
import { closestFrame } from "@semio/utils";
import { TrackedTooltip, useTrackedTooltip } from "@semio/ui";
import { useZoomGestures } from "./hooks/use-zoom-gestures";
import { useTrackContext } from "./hooks/use-track-context";
import { usePairSprings } from "./hooks/use-pair-springs";
import { useHoverSpring } from "./hooks/use-hover-spring";
import { TIMELINE_PADDING } from "./constants";
import { ViolationSet, Violation } from "./types";
import { useWithZoom } from "./hooks/use-with-zoom";

export interface ViolationDisplayProps {
  violationSet: ViolationSet;
  ignoreZoom?: boolean;
  useCustomColor?: boolean;
}
function InnerViolationDisplay({
  violationSet,
  ignoreZoom = false,
  useCustomColor = false,
}: ViolationDisplayProps): ReactNode {
  return (
    <g mask="url(#diagonalStripe)">
      {violationSet.segments.map((segment) => (
        <ViolationSegmentDisplay
          key={segment.id}
          segment={segment}
          violations={violationSet.violations}
          ignoreZoom={ignoreZoom}
          useCustomColor={useCustomColor}
        />
      ))}
    </g>
  );
}

interface ViolationSegmentDisplayProps {
  segment: {
    id: string;
    stampRange: [number, number];
    violations: string[];
  };
  violations: Record<string, Violation>;
  ignoreZoom: boolean;
  useCustomColor: boolean;
}

function InnerViolationSegmentDisplay({
  segment,
  violations,
  ignoreZoom,
}: ViolationSegmentDisplayProps) {
  const rectRefOrig = useRef<SVGRectElement>(null);
  const floatingRefOrig = useRef<HTMLDivElement>(null);

  // const transformSpring = useSpringValue<string>("translate(0, 0)");
  const { scale: xScale, bounds, frameCount, color } = useTrackContext();
  const { left, width } = usePairSprings(segment.stampRange[0], segment.stampRange[1], ignoreZoom);
  const { setHoverpoint, clearHoverpoint } = useHoverSpring(ignoreZoom);
  const withZoom = useWithZoom(ignoreZoom);

  const { floatingStyles, elementRefs, context, updateHoverState } = useTrackedTooltip(
    rectRefOrig,
    floatingRefOrig,
    "top",
    "x",
    4,
  );

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
        containerStyles={{ ...floatingStyles, "--track-color": color } as CSSProperties}
        open={context.open}
      >
        <div className="flex-col max-w-72">
          <div className="px-2 py-1.5 bg-neutral-50/50 dark:bg-neutral-950/50 flex-row flex justify-between">
            Violation{segment.violations.length > 1 ? "s" : ""}
            <div className="bg-[--track-color] text-black min-w-6 text-center">
              {segment.violations.length}
            </div>
          </div>
          <div className="p-2 grid grid-cols-3 gap-2">
            {segment.violations.map((violationId) => {
              return (
                <>
                  <div
                    key={`${violationId}-label`}
                    className="bg-[--track-color] bg-opacity-25 text-black px-2 py-0.5"
                  >
                    {violations[violationId].type}
                  </div>
                  <div key={`${violationId}-description`} className="col-span-2 text-wrap">
                    {violations[violationId].message}
                  </div>
                </>
              );
            })}
          </div>
        </div>
      </TrackedTooltip>
      <animated.rect
        ref={elementRefs.triggerRef}
        x={left.to((ls) => xScale(ls))}
        width={width.to((ws) => Math.max(0, xScale(ws) - TIMELINE_PADDING))}
        y={0}
        className={clsx("fill-[--track-color] h-full opacity-50 hover:opacity-75")}
      />
    </>
  );
}

export const ViolationDisplay = memo(InnerViolationDisplay);
const ViolationSegmentDisplay = memo(InnerViolationSegmentDisplay);
