import { type ReactNode, memo } from "react";
import { clsx } from "clsx";
import { animated } from "@react-spring/web";
import { RawValue } from "@semio/utils";
import { useTrackContext, useBezierPathSpring } from "../../hooks";
import { InstancedFrameInfo, TrackRender } from "../../types";

export interface InterpolationSegmentProps {
  start: InstancedFrameInfo;
  end: InstancedFrameInfo;
  pseudoRegion?: boolean;
}
function InnerInterpolationSegment({
  start,
  end,
  pseudoRegion = false,
}: InterpolationSegmentProps): ReactNode {
  const { trackIds, trackRender } = useTrackContext();

  const resolvedTrackRender = trackIds.length === 1 ? trackRender : TrackRender.Dope;

  const { start: startValue, end: endValue } = getStartAndEnd(trackIds, start, end, pseudoRegion);

  const pathLineSpring = useBezierPathSpring(
    resolvedTrackRender === TrackRender.Dope,
    start.stamp,
    end.stamp,
    startValue,
    endValue,
    resolvedTrackRender !== TrackRender.Dope,
    false,
  );

  const pathFillSpring = useBezierPathSpring(
    resolvedTrackRender === TrackRender.Dope,
    start.stamp,
    end.stamp,
    startValue,
    endValue,
    resolvedTrackRender !== TrackRender.Dope,
    true,
  );

  return (
    <g mask={pseudoRegion ? "url(#verticalStripe)" : undefined}>
      <animated.path
        key="fill"
        d={pathFillSpring}
        className={clsx(
          "transition-[colors,fill] duration-75 pointer-events-none",
          "fill-transparent stroke-transparent",
          !pseudoRegion &&
            "group-aria-expanded:fill-[--track-color] group-hover:fill-[--track-color]",
          "group-aria-expanded:opacity-50 group-hover:opacity-50",
        )}
      />
      <animated.path
        key="line"
        // strokeDasharray={pseudoRegion ? "5 5" : "none"}
        // strokeDashoffset={pseudoRegion ? "2.5" : "none"}
        d={pathLineSpring}
        className={clsx(
          "transition-[colors,stroke] duration-75 pointer-events-none",
          "stroke-transparent fill-transparent",
          resolvedTrackRender === TrackRender.Dope ? "stroke-[4px]" : "stroke-[1.5px]",
          "group-aria-expanded:stroke-[--track-color] group-hover:stroke-[--track-color]",
        )}
      />
    </g>
  );
}

export const InterpolationSegment = memo(InnerInterpolationSegment);

// const getRenderType = (
//   showPreviews: boolean,
//   startValue: RawValue | null,
//   endValue: RawValue | null,
// ): "line" | "curve" => {
//   if (!showPreviews) return "line";
//   if (typeof startValue === "number" && typeof endValue === "number") return "curve";
//   return "line";
// };

function getStartAndEnd(
  trackIds: string[],
  start: InstancedFrameInfo,
  end: InstancedFrameInfo,
  pseudoRegion: boolean,
): { start: RawValue; end: RawValue } {
  if (trackIds.length === 1) {
    let startValue: RawValue | undefined = start.points?.[0]?.value ?? undefined;
    let endValue: RawValue | undefined = end.points?.[0]?.value ?? undefined;
    if (startValue === undefined && endValue !== undefined && pseudoRegion) {
      startValue = endValue;
    } else if (endValue === undefined && startValue !== undefined && pseudoRegion) {
      endValue = startValue;
    }
    if (startValue === undefined || endValue === undefined) {
      return {
        start: 0.5,
        end: 0.5,
      };
    }
    return {
      start: startValue,
      end: endValue,
    };
  }
  return {
    start: 0.5,
    end: 0.5,
  };
}
