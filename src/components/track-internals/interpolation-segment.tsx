import { type ReactNode, memo, useMemo } from "react";
import { clsx } from "clsx";
import { motion, useTransform } from "motion/react";
import { RawValue, AnimatableValue, RawVector3, RawColor, RawEuler } from "@semio/utils";
import {
  useTrackContext,
  useBezierPathSpring,
  PathType,
  getPath,
  useScaleInverseSpring,
  useColors,
} from "../../hooks";
import { InstancedFrameInfo, TrackRender } from "../../types";

export interface InterpolationSegmentProps {
  start: InstancedFrameInfo;
  end: InstancedFrameInfo;
  pseudoRegion?: boolean;
  isInitial?: boolean;
  isFinal?: boolean;
  showFullLine?: boolean;
}
function InnerInterpolationSegment({
  start,
  end,
  pseudoRegion = false,
  isInitial = false,
  isFinal = false,
  showFullLine = false,
}: InterpolationSegmentProps): ReactNode {
  const {
    trackIds,
    trackRender,
    attribute,
    trackType,
    xScale,
    yScale,
    bounds: { height },
    animationDuration,
  } = useTrackContext();

  const { start: startValue, end: endValue } = getStartAndEnd(
    trackIds,
    start,
    end,
    pseudoRegion,
    trackRender,
    trackType,
    attribute,
  );

  const color = useColors(trackIds);

  const pathType =
    trackRender === TrackRender.Preview || trackRender === TrackRender.Transition
      ? PathType.Bezier
      : PathType.Line;

  const pathLineSpring = useBezierPathSpring(
    start.stamp,
    end.stamp,
    startValue,
    endValue,
    pathType,
    pseudoRegion && isInitial,
    pseudoRegion && isFinal,
  );

  const pathFill = useMemo(() => {
    const path = getPath(
      pathType === PathType.Bezier ? PathType.BezierFilled : pathType,
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
    startValue,
    endValue,
    animationDuration,
    xScale,
    yScale,
    pathType,
  ]);

  const inverseScale = useScaleInverseSpring(false);

  const strokeDashArray = useTransform(inverseScale, (scale) => {
    if (pseudoRegion && trackRender !== TrackRender.Key) {
      const val = (scale * 5).toString();
      return `${val} ${val}`;
    } else {
      return "none";
    }
  });

  const pseudoRegionOpacityClass = showFullLine ? "opacity-50" : "opacity-0";

  return (
    <g>
      {(trackRender === TrackRender.Preview || trackRender === TrackRender.Transition) &&
        !pseudoRegion && (
          <motion.path
            key="fill"
            d={pathFill}
            fill={color}
            className={clsx(
              "transition-[colors,fill] duration-75 pointer-events-none",
              "stroke-transparent",
              "opacity-50",
            )}
          />
        )}
      <motion.path
        key="line"
        strokeDasharray={strokeDashArray}
        strokeDashoffset={pseudoRegion ? inverseScale : "none"}
        d={pathLineSpring}
        stroke={color}
        strokeWidth={getStroke(trackRender, pseudoRegion)}
        className={clsx(
          "transition-[colors,stroke] duration-75 pointer-events-none",
          "fill-transparent",
          trackRender === TrackRender.Key && pseudoRegion
            ? pseudoRegionOpacityClass
            : "opacity-100",
        )}
      />
    </g>
  );
}

export const InterpolationSegment = memo(InnerInterpolationSegment);

function getStroke(trackRender: TrackRender, pseudoRegion: boolean): number {
  if (trackRender === TrackRender.Key) {
    return 4;
  } else if (trackRender === TrackRender.Transition && pseudoRegion) {
    return 0;
  }
  return 1.5;
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
