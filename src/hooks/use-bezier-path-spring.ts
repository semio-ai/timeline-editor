import { useRef, useCallback } from "react";
import { SpringValue, useSpringValue } from "@react-spring/web";
import { PlayerData, RawValue } from "@semio/utils";
import { scaleLinear } from "@visx/scale";
import { shallow } from "zustand/shallow";
import { type ScaleLinear } from "../scale-linear";
import { springConfig } from "../spring-config";
import { useTrackContext } from "./use-track-context";
import { usePlayerSubscription } from "./use-player-subscription";

/**
 * A hook used to create a path spring based on a bezier curve. For now, always return an easeInOutCubic path.
 * @param showAsLine - A boolean that determines whether the path should be shown as a line.
 * @param stamp1 - The first timestamp.
 * @param stamp2 - The second timestamp.
 * @param value1 - The first value.
 * @param value2 - The second value.
 * @param ignoreZoom - A boolean that determines whether the zoom scale should be ignored.
 * @param removeBuffer - A boolean that determines whether the buffer should be removed.
 * @param filled - A boolean that determines whether the path should be filled.
 * @returns A spring value wrapping a path string.
 */
export function useBezierPathSpring(
  showAsLine: boolean,
  stamp1: number,
  stamp2: number,
  value1: RawValue,
  value2: RawValue,
  removeBuffer?: boolean,
  filled?: boolean,
): SpringValue<string> {
  let pathType: PathType = showAsLine ? PathType.Line : PathType.Bezier;
  if (filled && pathType === PathType.Bezier) {
    pathType = PathType.BezierFilled;
  }
  const buffer =
    removeBuffer || pathType === PathType.Bezier || pathType === PathType.BezierFilled ? 0 : 6;

  const {
    yScale,
    xScale,
    bounds: { height },
  } = useTrackContext();

  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: [0, 1],
      range: [0, 1],
    }),
  );

  const pathSpring = useSpringValue<string>(
    getPath(
      pathType,
      xScale(zoomScale.current(stamp1)) + buffer,
      yScale(pathType === PathType.Line ? 0.5 : (value1 as number)),
      xScale(zoomScale.current(stamp2)) - buffer,
      yScale(pathType === PathType.Line ? 0.5 : (value2 as number)),
      height,
    ),
    { config: springConfig },
  );

  const onViewportChange = useCallback(
    (viewport: [number, number]) => {
      const scale = scaleLinear({
        domain: viewport,
        range: [0, 1],
      });
      zoomScale.current = scale;
      void pathSpring.set(
        getPath(
          pathType,
          xScale(zoomScale.current(stamp1)) + buffer,
          yScale(pathType === PathType.Line ? 0.5 : (value1 as number)),
          xScale(zoomScale.current(stamp2)) - buffer,
          yScale(pathType === PathType.Line ? 0.5 : (value2 as number)),
          height,
        ),
      );
    },
    [pathSpring, stamp1, stamp2, value1, value2, xScale, yScale, pathType, buffer, height],
  );

  usePlayerSubscription((state: PlayerData) => state.player.viewport, onViewportChange, shallow);

  return pathSpring;
}

// Returns an easeInOutCubic path string.
function getBezierCurve(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${x1.toString()} ${y1.toString()} C ${(0.65 * x1 + 0.35 * x2).toString()} ${y1.toString()} ${(0.35 * x1 + 0.65 * x2).toString()} ${y2.toString()} ${x2.toString()} ${y2.toString()}`;
}

function getFilledBezierCurve(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  yRoot: number,
): string {
  return `M ${x1.toString()} ${yRoot.toString()} L ${x1.toString()} ${y1.toString()} C ${(0.65 * x1 + 0.35 * x2).toString()} ${y1.toString()} ${(0.35 * x1 + 0.65 * x2).toString()} ${y2.toString()} ${x2.toString()} ${y2.toString()} L ${x2.toString()} ${yRoot.toString()} Z`;
}

// Returns a straight line path string.
function getLine(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${x1.toString()} ${y1.toString()} L ${x2.toString()} ${y2.toString()}`;
}

function getPath(
  pathType: PathType,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  yRoot: number,
): string {
  switch (pathType) {
    case PathType.Line:
      return getLine(x1, y1, x2, y2);
    case PathType.Bezier:
      return getBezierCurve(x1, y1, x2, y2);
    case PathType.BezierFilled:
      return getFilledBezierCurve(x1, y1, x2, y2, yRoot);
  }
}

enum PathType {
  Line = "line",
  Bezier = "bezier",
  BezierFilled = "bezierFilled",
}
