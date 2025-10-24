import { useReducer } from "react";
import { useMotionValueEvent, MotionValue } from "motion/react";
import * as THREE from "three";

export interface MotionCubicBezierFillProps {
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

  // Baseline configuration
  baseline?: number; // Y coordinate for the bottom of the fill (default: 0)
  baselineExtension?: number; // Additional extension below baseline for complete coverage (default: 0)

  // Z coordinate (static for now)
  z?: number;
  renderOrder?: number;

  // Styling properties
  color?: string;
  opacity?: number;
  transparent?: boolean;

  // Performance and quality settings
  segments?: number;

  // Event handlers
  onPointerOver?: (event: any) => void;
  onPointerOut?: (event: any) => void;
  onClick?: (event: any) => void;
}

/**
 * A high-performance cubic Bezier fill component that creates a filled area below a curve.
 * Uses MotionValues to update the fill geometry when control points change,
 * maintaining high performance during animations.
 *
 * The fill is created using a custom BufferGeometry with triangle strips for efficiency.
 * The area extends from the cubic Bezier curve down to a specified baseline.
 *
 * ## Performance Considerations
 *
 * This implementation prioritizes performance over memory efficiency by recreating geometry
 * on each motion value change rather than updating vertices in-place. This approach:
 * - Avoids complex vertex buffer management and GPU synchronization issues
 * - Leverages Three.js's optimized geometry creation pipeline
 * - Maintains perfect synchronization with MotionCubicBezierLine component
 * - Uses triangle strip topology for efficient GPU rendering
 * - Minimizes draw calls with single mesh per fill
 *
 * For scenarios with many animated fills, consider using instanced rendering or
 * implementing vertex buffer updates for better memory usage.
 *
 * ## Baseline Configuration
 *
 * The `baseline` prop sets the Y coordinate where the fill area ends, while
 * `baselineExtension` adds additional space below the baseline to ensure complete
 * visual coverage, especially useful when working with padded coordinate systems.
 *
 * @example
 * ```tsx
 * import { useMotionValue } from "motion/react";
 * import { MotionCubicBezierFill } from "@semio/animation";
 *
 * function MyComponent() {
 *   const startX = useMotionValue(0);
 *   const startY = useMotionValue(50);
 *   const endX = useMotionValue(100);
 *   const endY = useMotionValue(50);
 *   const cp1X = useMotionValue(25);
 *   const cp1Y = useMotionValue(75);
 *   const cp2X = useMotionValue(75);
 *   const cp2Y = useMotionValue(25);
 *
 *   return (
 *     <MotionCubicBezierFill
 *       start={{ x: startX, y: startY }}
 *       end={{ x: endX, y: endY }}
 *       controlPoint1={{ x: cp1X, y: cp1Y }}
 *       controlPoint2={{ x: cp2X, y: cp2Y }}
 *       baseline={0}
 *       baselineExtension={5}
 *       color="#ff0000"
 *       opacity={0.5}
 *       segments={50}
 *     />
 *   );
 * }
 * ```
 */
export function MotionCubicBezierFill({
  start,
  end,
  controlPoint1,
  controlPoint2,
  baseline = 0,
  baselineExtension = 0,
  z = 0,
  color = "#ffffff",
  opacity = 0.5,
  transparent = true,
  segments = 20,
  onPointerOver,
  onPointerOut,
  onClick,
  renderOrder,
}: MotionCubicBezierFillProps) {
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

  // Get curve points
  const curvePoints = curve.getPoints(segments);

  // Calculate effective baseline with extension
  const effectiveBaseline = baseline - Math.abs(baselineExtension);

  // Create vertices for fill (curve points + baseline points)
  const vertices: number[] = [];
  const indices: number[] = [];

  // Add curve points and corresponding baseline points
  for (let i = 0; i <= segments; i++) {
    const curvePoint = curvePoints[i];

    // Add curve point (top)
    vertices.push(curvePoint.x, curvePoint.y, curvePoint.z);

    // Add baseline point (bottom)
    vertices.push(curvePoint.x, effectiveBaseline, curvePoint.z);
  }

  // Create triangle strip indices
  for (let i = 0; i < segments; i++) {
    const topCurrent = i * 2;
    const bottomCurrent = i * 2 + 1;
    const topNext = (i + 1) * 2;
    const bottomNext = (i + 1) * 2 + 1;

    // Create two triangles per segment
    indices.push(topCurrent, bottomCurrent, topNext);
    indices.push(bottomCurrent, bottomNext, topNext);
  }

  // Create geometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);

  // Create material
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent,
    opacity,
    side: THREE.DoubleSide,
  });

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
    <mesh
      geometry={geometry as any}
      material={material as any}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
      renderOrder={renderOrder}
    />
  );
}
