import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Instance, Line, PositionMesh } from "@react-three/drei";
import * as THREE from "three";
import { Theme } from "@semio/ui";
import { useSpring, useTransform } from "motion/react";
import { InstancedFrameInfo, TrackRender } from "../../../types";
import { useColors } from "../../../hooks";
import { computeOklabMix, getHighlightColor } from "../../../functions";

export interface DataPointProps {
  height?: number;
  data: InstancedFrameInfo;
  onDragStart: () => void;
  onDragEnd: () => void;
  theme?: Theme.Dark | Theme.Light;
  trackRender?: TrackRender;
}

export function DataPoint({
  data,
  theme = Theme.Light,
  trackRender = TrackRender.Key,
  height = 36,
}: DataPointProps) {
  const instanceRefFg = useRef<PositionMesh>(null);
  const instanceRefBg = useRef<PositionMesh>(null);
  const lineRef = useRef<THREE.Line>(null);
  const groupRef = useRef<THREE.Group>(null);

  const { stamp, points } = data;

  const color = useColors(points.map((p) => p.trackId));

  useFrame(({ viewport, camera }) => {
    if (instanceRefFg.current && instanceRefBg.current) {
      const baseWidth = viewport.width; // Use actual viewport width as base
      const currentWidth =
        (camera as THREE.OrthographicCamera).right - (camera as THREE.OrthographicCamera).left;
      const scaleFactor = currentWidth / baseWidth;

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

  return (
    <group ref={groupRef as any}>
      <Instance
        ref={instanceRefFg}
        position={[stamp, 0, 10]}
        rotation={[Math.PI / 2, 0, 0]}
        // eslint-dissable-next-line
        color={color}
        onPointerOver={() => hovered.set(1)}
        onPointerOut={() => hovered.set(0)}
      />
      {/* Render a darker hexagon in the background */}
      <Instance
        ref={instanceRefBg}
        position={[stamp, 0, 2]}
        rotation={[Math.PI / 2, 0, 0]}
        // eslint-dissable-next-line
        color={accentColor}
      />
      {/* Render a vertical line at the stamp */}
      <Line
        ref={lineRef as any}
        points={[
          [stamp, height / -2, 0],
          [stamp, height / 2, 0],
        ]}
        color={color}
        lineWidth={1.5}
        opacity={lineOpacity.get()}
        transparent
      />
    </group>
  );
}

const RENDERS_WITH_LINES = [TrackRender.Preview, TrackRender.Transition];
