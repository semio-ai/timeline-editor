import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, memo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Instance, Line, PositionMesh } from "@react-three/drei";
import * as THREE from "three";
import { Theme } from "@semio/ui";
import { useSpring, useTransform } from "motion/react";
import { InstancedFrameInfo, TrackRender } from "../../../types";
import { useColors } from "../../../hooks";
import { computeOklabMix, createLinearScale, getHighlightColor } from "../../../functions";

export interface DataPointProps {
  height?: number;
  data: InstancedFrameInfo;
  onDragStart: () => void;
  onDragEnd: () => void;
  theme?: Theme.Dark | Theme.Light;
  trackRender?: TrackRender;
  verticalBounds?: { min: number; max: number };
}

export const DataPoint = memo(function DataPoint({
  data,
  theme = Theme.Light,
  trackRender = TrackRender.Key,
  height = 36,
  verticalBounds = { min: -18, max: 18 },
}: DataPointProps) {
  const instanceRefFg = useRef<PositionMesh>(null);
  const instanceRefBg = useRef<PositionMesh>(null);
  const lineRef = useRef<THREE.Line>(null);
  const groupRef = useRef<THREE.Group>(null);

  const { stamp, points } = data;

  const linearScale = useMemo(() => {
    const buffer = height * 0.4;
    return createLinearScale([verticalBounds.min, verticalBounds.max], [-buffer, buffer]);
  }, [height, verticalBounds]);

  const initialValue = linearScale((points[0]?.value as number | undefined) ?? 0);

  const yPosition = useSpring(trackRender === TrackRender.Spline ? initialValue : 0, {
    stiffness: 300,
    damping: 30,
  });

  // When the _value_ or track render changes, update the spring
  useEffect(() => {
    if (trackRender === TrackRender.Spline) {
      yPosition.set(initialValue);
    } else {
      yPosition.set(0);
    }
  }, [initialValue, yPosition, trackRender]);

  const color = useColors(points.map((p) => p.trackId));
  const { viewport, camera } = useThree();

  // Calculate scale factor function
  const calculateScaleFactor = useCallback(() => {
    const baseWidth = viewport.width;
    const currentWidth =
      (camera as THREE.OrthographicCamera).right - (camera as THREE.OrthographicCamera).left;
    return currentWidth / baseWidth;
  }, [viewport.width, camera]);

  // Set initial scale immediately to prevent stretched appearance
  useLayoutEffect(() => {
    if (instanceRefFg.current && instanceRefBg.current) {
      const scaleFactor = calculateScaleFactor();
      instanceRefFg.current.scale.set(scaleFactor, 1, 1);
      instanceRefBg.current.scale.set(scaleFactor * 1.2, 1, 1.2);
    }
  }, [viewport.width, camera, calculateScaleFactor]);

  // Continue updating scale on each frame
  useFrame(() => {
    if (instanceRefFg.current && instanceRefBg.current) {
      const scaleFactor = calculateScaleFactor();
      instanceRefFg.current.scale.set(scaleFactor, 1, 1);
      instanceRefBg.current.scale.set(scaleFactor * 1.2, 1, 1.2);
    }
  });

  const showsLine = RENDERS_WITH_LINES.includes(trackRender);

  const lineOpacity = useSpring(
    showsLine ? 1 : 0,
    // A config for a stiff spring
    { stiffness: 300, damping: 20, mass: 0.5 },
  );

  useEffect(() => {
    lineOpacity.set(showsLine ? 1 : 0);
  }, [lineOpacity, showsLine]);

  const accentColor = computeOklabMix(color, theme === Theme.Dark ? "#202020" : "#EFEFEF", 0.7);
  const highlightColor = getHighlightColor(color, theme ?? Theme.Light);

  const hovered = useSpring(
    0,
    // A config for a stiff spring
    { stiffness: 300, damping: 20, mass: 0.5 },
  );

  const hoverColor = useTransform(hovered, [0, 1], [color, highlightColor]);

  hoverColor.on("change", (v) => {
    if (instanceRefFg.current) {
      if ("color" in instanceRefFg.current) {
        instanceRefFg.current.color.set(v);
      }
    }
  });

  lineOpacity.on("change", (v) => {
    if (lineRef.current) {
      (lineRef.current.material as THREE.LineBasicMaterial).opacity = v;
      (lineRef.current.material as THREE.LineBasicMaterial).transparent = v < 1;
    }
  });

  // Set the y position of the instances based on the yPosition spring
  yPosition.on("change", (y) => {
    if (instanceRefFg.current && instanceRefBg.current) {
      instanceRefFg.current.position.y = y;
      instanceRefBg.current.position.y = y;
    }
  });

  return (
    <group ref={groupRef as any}>
      <Instance
        ref={instanceRefFg}
        position={[stamp, trackRender === TrackRender.Spline ? yPosition.get() : 0, 10]}
        rotation={[Math.PI / 2, 0, 0]}
        // eslint-dissable-next-line
        color={color}
        onPointerOver={() => hovered.set(1)}
        onPointerOut={() => hovered.set(0)}
      />
      {/* Render a darker hexagon in the background */}
      <Instance
        ref={instanceRefBg}
        position={[stamp, trackRender === TrackRender.Spline ? yPosition.get() : 0, 2]}
        rotation={[Math.PI / 2, 0, 0]}
        // eslint-dissable-next-line
        color={accentColor}
      />
      {/* Render a vertical line at the stamp */}
      <Line
        ref={lineRef as any}
        points={[
          [stamp, height / -2 + 1, 1],
          [stamp, height / 2 - 1, 1],
        ]}
        color={color}
        lineWidth={1.5}
        opacity={lineOpacity.get()}
        transparent
      />
    </group>
  );
});

const RENDERS_WITH_LINES = [TrackRender.Preview, TrackRender.Transition];
