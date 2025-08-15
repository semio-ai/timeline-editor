import { useReducer } from "react";
import { Line } from "@react-three/drei";
import { useMotionValueEvent, MotionValue } from "motion/react";
import * as THREE from "three";

export interface MotionCubicBezierLineProps {
  // Motion values for the four control points
  start: {
    x: MotionValue<number>;
    y: MotionValue<number>;
  };
  end: {
    x: MotionValue<number>;
    y: MotionValue<number>;
  };
  controlPoint1: {
    x: MotionValue<number>;
    y: MotionValue<number>;
  };
  controlPoint2: {
    x: MotionValue<number>;
    y: MotionValue<number>;
  };

  // Z coordinate (static for now)
  z?: number;

  // Styling properties
  color?: string;
  lineWidth?: number;
  opacity?: number;
  transparent?: boolean;
  dashed?: boolean;

  // Performance and quality settings
  segments?: number;

  // Event handlers
  onPointerOver?: (event: any) => void;
  onPointerOut?: (event: any) => void;
  onClick?: (event: any) => void;
}

/**
 * A high-performance cubic Bezier line component that wraps drei's Line.
 * Uses MotionValues to update the line points when control points change,
 * maintaining high performance during animations.
 *
 * @example
 * ```tsx
 * import { useMotionValue } from "motion/react";
 * import { MotionCubicBezierLine } from "@semio/animation";
 *
 * function MyComponent() {
 *   const startX = useMotionValue(0);
 *   const startY = useMotionValue(0);
 *   const endX = useMotionValue(100);
 *   const endY = useMotionValue(100);
 *   const cp1X = useMotionValue(25);
 *   const cp1Y = useMotionValue(-25);
 *   const cp2X = useMotionValue(75);
 *   const cp2Y = useMotionValue(125);
 *
 *   return (
 *     <MotionCubicBezierLine
 *       start={{ x: startX, y: startY }}
 *       end={{ x: endX, y: endY }}
 *       controlPoint1={{ x: cp1X, y: cp1Y }}
 *       controlPoint2={{ x: cp2X, y: cp2Y }}
 *       color="#ff0000"
 *       lineWidth={2}
 *       segments={50}
 *     />
 *   );
 * }
 * ```
 */
export function MotionCubicBezierLine({
  start,
  end,
  controlPoint1,
  controlPoint2,
  z = 0,
  color = "#ffffff",
  lineWidth = 1,
  opacity = 1,
  transparent = false,
  dashed = false,
  segments = 20,
  onPointerOver,
  onPointerOut,
  onClick,
}: MotionCubicBezierLineProps) {
  // Force re-render when motion values change using conventional pattern
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const triggerUpdate = forceUpdate;

  // Compute the cubic bezier curve points directly
  const currentValues = {
    startX: start.x.get(),
    startY: start.y.get(),
    endX: end.x.get(),
    endY: end.y.get(),
    cp1X: controlPoint1.x.get(),
    cp1Y: controlPoint1.y.get(),
    cp2X: controlPoint2.x.get(),
    cp2Y: controlPoint2.y.get(),
  };

  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(currentValues.startX, currentValues.startY, z),
    new THREE.Vector3(currentValues.cp1X, currentValues.cp1Y, z),
    new THREE.Vector3(currentValues.cp2X, currentValues.cp2Y, z),
    new THREE.Vector3(currentValues.endX, currentValues.endY, z),
  );

  const points = curve
    .getPoints(segments)
    .map((point) => [point.x, point.y, point.z] as [number, number, number]);

  // Motion value event listeners
  useMotionValueEvent(start.x, "change", triggerUpdate);
  useMotionValueEvent(start.y, "change", triggerUpdate);
  useMotionValueEvent(end.x, "change", triggerUpdate);
  useMotionValueEvent(end.y, "change", triggerUpdate);
  useMotionValueEvent(controlPoint1.x, "change", triggerUpdate);
  useMotionValueEvent(controlPoint1.y, "change", triggerUpdate);
  useMotionValueEvent(controlPoint2.x, "change", triggerUpdate);
  useMotionValueEvent(controlPoint2.y, "change", triggerUpdate);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={lineWidth}
      opacity={opacity}
      transparent={transparent}
      dashed={dashed}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    />
  );
}
