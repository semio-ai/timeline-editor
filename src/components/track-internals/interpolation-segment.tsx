import { type ReactNode, memo, useMemo } from "react";
import { clsx } from "clsx";
import { motion } from "motion/react";
import { RawValue, AnimatableValue, RawVector3, RawColor, RawEuler } from "@semio/utils";
import {
  useTrackContext,
  useBezierPathSpring,
  useAnimationStore,
  PathType,
  getPath,
} from "../../hooks";
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
  const {
    trackIds,
    trackRender,
    attribute,
    trackType,
    animationId,
    xScale,
    yScale,
    bounds: { height },
  } = useTrackContext();

  const animationDuration = useAnimationStore(
    (state) => state.animations[animationId]?.duration ?? 5000,
  );

  const { start: startValue, end: endValue } = getStartAndEnd(
    trackIds,
    start,
    end,
    pseudoRegion,
    trackRender,
    trackType,
    attribute,
  );

  // const pathLineSpring = useBezierPathSpring(
  //   start.stamp * animationDuration,
  //   end.stamp * animationDuration,
  //   startValue,
  //   endValue,
  //   trackRender === TrackRender.Preview || trackRender === TrackRender.Transition
  //     ? PathType.Bezier
  //     : PathType.Line,
  // );
  //
  const pathLine = useMemo(() => {
    const pathType =
      trackRender === TrackRender.Preview || trackRender === TrackRender.Transition
        ? PathType.Bezier
        : PathType.Line;
    const path = getPath(
      pathType,
      xScale(start.stamp * animationDuration),
      yScale(typeof startValue === "number" ? startValue : 0.5),
      xScale(end.stamp * animationDuration),
      yScale(typeof endValue === "number" ? endValue : 0.5),
      height,
    );
    return path;
  }, [
    height,
    start.stamp,
    end.stamp,
    trackRender,
    startValue,
    endValue,
    animationDuration,
    xScale,
    yScale,
  ]);

  const pathFillSpring = useBezierPathSpring(
    start.stamp * animationDuration,
    end.stamp * animationDuration,
    startValue,
    endValue,
    trackRender === TrackRender.Preview || trackRender === TrackRender.Transition
      ? PathType.BezierFilled
      : PathType.Line,
  );

  if (trackRender === TrackRender.Key && pseudoRegion) {
    return null;
  }

  // pathLineSpring.on("change", console.log);

  return (
    <g>
      {(trackRender === TrackRender.Preview || trackRender === TrackRender.Transition) && (
        <motion.path
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
      )}
      <path
        key="line"
        strokeDasharray={pseudoRegion ? "5 5" : "none"}
        strokeDashoffset={pseudoRegion ? "2.5" : "none"}
        d={pathLine}
        className={clsx(
          "transition-[colors,stroke] duration-75 pointer-events-none",
          "stroke-transparent fill-transparent",
          getStroke(trackRender, pseudoRegion),
          "group-aria-expanded:stroke-[--track-color] group-hover:stroke-[--track-color]",
        )}
      />
    </g>
  );
}

export const InterpolationSegment = memo(InnerInterpolationSegment);

function getStroke(trackRender: TrackRender, pseudoRegion: boolean): string {
  if (trackRender === TrackRender.Key) {
    return "stroke-[4px]";
  } else if (trackRender === TrackRender.Transition && pseudoRegion) {
    return "stroke-0";
  }
  return "stroke-[1.5px]";
}

function getStartAndEnd(
  trackIds: string[],
  start: InstancedFrameInfo,
  end: InstancedFrameInfo,
  pseudoRegion: boolean,
  trackRender: TrackRender,
  trackType: AnimatableValue["type"] | "multiple",
  attribute?: string,
): { start: RawValue; end: RawValue } {
  if (trackRender === TrackRender.Transition) {
    return {
      start: 0,
      end: 1,
    };
  }
  if (trackIds.length === 1 && trackRender === TrackRender.Preview) {
    let startValue: RawValue | undefined;
    let endValue: RawValue | undefined;
    if (trackType === "number") {
      startValue = start.points?.[0]?.value ?? undefined;
      endValue = end.points?.[0]?.value ?? undefined;
    } else if (ComplexTypes.includes(trackType) && attribute) {
      startValue =
        (start.points?.[0]?.value as RawVector3 | RawEuler | RawColor | undefined)?.[
          attribute as ComplexField
        ] ?? undefined;
      endValue =
        (end.points?.[0]?.value as RawVector3 | RawEuler | RawColor | undefined)?.[
          attribute as ComplexField
        ] ?? undefined;
    }
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

const ComplexTypes = ["vector3", "euler", "rgb", "hsl"];
type ComplexRawValue = RawVector3 | RawEuler | RawColor;
type ComplexField = keyof ComplexRawValue;
