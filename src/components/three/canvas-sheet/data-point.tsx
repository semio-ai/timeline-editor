import { useEffect, useMemo, useRef, memo, useState } from "react";
import { useShallow } from "zustand/shallow";
import { useGesture } from "@use-gesture/react";
import { useThree } from "@react-three/fiber";
import { Instance, Line, PositionMesh, useCursor } from "@react-three/drei";
import * as THREE from "three";
import { Theme } from "@semio/ui";
import { useMotionValue, useMotionValueEvent, useSpring, useTransform } from "motion/react";
import { InstancedFrameInfo, Source, TrackRender } from "../../../types";
import { useAnimationStore, useColors, useInvariantScale } from "../../../hooks";
import {
  compareInstancedFrames,
  computeOklabMix,
  createLinearScale,
  FrameComparison,
} from "../../../functions";

const BG_MULTIPLIER = 1.2;

export interface DataPointProps {
  height?: number;
  data: InstancedFrameInfo;
  allData: InstancedFrameInfo[];
  onDragStart: () => void;
  onDragEnd: () => void;
  theme?: Theme.Dark | Theme.Light;
  trackRender?: TrackRender;
  verticalBounds?: { min: number; max: number };
  sources: Source[];
}

export const DataPoint = memo(function DataPoint({
  data,
  allData,
  theme = Theme.Light,
  trackRender = TrackRender.Key,
  height = 36,
  verticalBounds = { min: -18, max: 18 },
  sources = [],
  onDragEnd,
  onDragStart,
}: DataPointProps) {
  const instanceRefFg = useRef<PositionMesh>(null);
  const instanceRefBg = useRef<PositionMesh>(null);
  const lineRef = useRef<THREE.Line>(null);
  const groupRef = useRef<THREE.Group>(null);

  const clickMarker = useAnimationStore(useShallow((state) => state.clickMarker));

  const isSelected = useAnimationStore(
    useShallow((state) => {
      const comparisons: FrameComparison[] = state.selection.map((s) =>
        compareInstancedFrames(s, data),
      );
      return (
        comparisons.includes(FrameComparison.Equal) ||
        comparisons.includes(FrameComparison.Superset)
      );
    }),
  );

  const isReference = useAnimationStore(
    useShallow((state) => {
      if (!state.referenceMarker) return false;
      return compareInstancedFrames(state.referenceMarker.marker, data) === FrameComparison.Equal;
    }),
  );
  // const referenceMarker = useAnimationStore(useShallow((state) => state.referenceMarker));

  const [isHovered, setIsHovered] = useState(false);

  // const isSelected = useMemo(() => {
  //   const comparisons: FrameComparison[] = selection.map((s) => compareInstancedFrames(s, data));
  //   return (
  //     comparisons.includes(FrameComparison.Equal) || comparisons.includes(FrameComparison.Superset)
  //   );
  // }, [selection, data]);

  // const isReference = useMemo(() => {
  //   if (!referenceMarker) return false;
  //   return compareInstancedFrames(referenceMarker.marker, data) === FrameComparison.Equal;
  // }, [referenceMarker, data]);

  const { stamp, points } = data;

  const linearScale = useMemo(() => {
    const buffer = height * 0.4;
    return createLinearScale([verticalBounds.min, verticalBounds.max], [-buffer, buffer]);
  }, [height, verticalBounds]);

  const rawInitial: number = useMemo(() => {
    if (points.length !== 1) return 0;
    if (sources.length !== 1) return 0;
    const source = sources.find((s) => s.trackId === points[0].trackId);
    if (!source) return 0;
    if (source.type === "number" && typeof points[0]?.value === "number") {
      return points[0].value;
    } else if (source.type !== "number" && source.attribute) {
      // If it's not a number, but has an attribute, and the value is an object, try to get the attribute value
      const val = points[0].value as any;
      if (val && typeof val === "object" && source.attribute in val) {
        const innerVal = val[source.attribute];
        if (typeof innerVal === "number") {
          return innerVal;
        }
        return 0;
      }
      return 0;
    }
    return 0;
  }, [sources, points]);

  const initialValue = linearScale(rawInitial);

  const yPosition = useSpring(trackRender === TrackRender.Spline ? initialValue : 0, {
    stiffness: 300,
    damping: 30,
  });

  const gl = useThree((s) => s.gl);
  // When the _value_ or track render changes, update the spring
  useEffect(() => {
    if (trackRender === TrackRender.Spline) {
      yPosition.set(initialValue);
    } else {
      yPosition.set(0);
    }
  }, [initialValue, yPosition, trackRender]);

  const baseColor = useColors(points.map((p) => p.trackId));
  const baseBackdropColor = useMemo(() => {
    return computeOklabMix(baseColor, theme === Theme.Dark ? "#202020" : "#EFEFEF", 0.7);
  }, [baseColor, theme]);
  const hoverColor = useMemo(() => {
    return computeOklabMix(baseColor, theme === Theme.Dark ? "#FFFFFF" : "#000000", 0.4);
  }, [baseColor, theme]);
  const selectionColor = useMemo(() => {
    return computeOklabMix(baseColor, theme === Theme.Dark ? "#FFFFFF" : "#000000", 0.8);
  }, [baseColor, theme]);

  const showsLine = RENDERS_WITH_LINES.includes(trackRender);

  const lineOpacity = useSpring(
    showsLine ? 1 : 0,
    // A config for a stiff spring
    { stiffness: 300, damping: 20, mass: 0.5 },
  );

  useEffect(() => {
    lineOpacity.set(showsLine ? 1 : 0);
  }, [lineOpacity, showsLine]);

  // const fillSpring = useSpring(getFillIndex(isHovered, isSelected, isReference), {
  //   stiffness: 300,
  //   damping: 20,
  //   mass: 0.5,
  // });
  //
  const fillIndex = useMotionValue(getFillIndex(isHovered, isSelected, isReference));
  const backdropIndex = useMotionValue(getBackdropIndex(isSelected, isReference));

  // const backdropSpring = useSpring(getBackdropIndex(isSelected, isReference), {
  //   stiffness: 300,
  //   damping: 20,
  //   mass: 0.5,
  // });

  const fillColor = useTransform(fillIndex, [0, 0.5, 1], [baseColor, hoverColor, selectionColor]);

  const backdropColor = useTransform(
    backdropIndex,
    [0, 0.5, 1],
    [baseBackdropColor, baseColor, selectionColor],
  );

  useEffect(() => {
    fillIndex.set(getFillIndex(isHovered, isSelected, isReference));
  }, [fillIndex, isHovered, isSelected, isReference]);

  useEffect(() => {
    backdropIndex.set(getBackdropIndex(isSelected, isReference));
  }, [backdropIndex, isSelected, isReference]);

  useCursor(isHovered, "pointer", "auto", gl.domElement);

  const bgScale = useSpring(isSelected ? BG_MULTIPLIER * 1.1 : BG_MULTIPLIER, {
    stiffness: 300,
    damping: 20,
    mass: 0.5,
  });

  useEffect(() => {
    bgScale.set(isSelected ? BG_MULTIPLIER * 1.1 : BG_MULTIPLIER);
  }, [isSelected, bgScale]);

  const scaleX = useInvariantScale();

  // Update the fill color when it changes
  useMotionValueEvent(fillColor, "change", (c) => {
    if (instanceRefFg.current) {
      if ("color" in instanceRefFg.current) {
        instanceRefFg.current.color.set(c);
      }
    }
  });

  // Update the backdrop color when it changes
  useMotionValueEvent(backdropColor, "change", (c) => {
    if (instanceRefBg.current) {
      if ("color" in instanceRefBg.current) {
        instanceRefBg.current.color.set(c);
      }
    }
  });

  // Set the line opacity based on the lineOpacity spring
  useMotionValueEvent(lineOpacity, "change", (v) => {
    if (lineRef.current) {
      (lineRef.current.material as THREE.LineBasicMaterial).opacity = v;
      (lineRef.current.material as THREE.LineBasicMaterial).transparent = v < 1;
    }
  });

  // Set the y position of the instances based on the yPosition spring
  useMotionValueEvent(yPosition, "change", (y) => {
    if (instanceRefFg.current && instanceRefBg.current) {
      instanceRefFg.current.position.y = y;
      instanceRefBg.current.position.y = y;
    }
  });

  // Update the scale to be invariant to zoom level
  useMotionValueEvent(scaleX, "change", (s) => {
    if (instanceRefFg.current && instanceRefBg.current) {
      instanceRefFg.current.scale.x = s;
      instanceRefBg.current.scale.x = s * bgScale.get(); // Background is slightly larger
      instanceRefBg.current.scale.z = bgScale.get();
    }
  });

  useMotionValueEvent(bgScale, "change", (s) => {
    if (instanceRefBg.current) {
      instanceRefBg.current.scale.x = scaleX.get() * s; // Background is slightly larger
      instanceRefBg.current.scale.z = s;
    }
  });

  const bind = useGesture({
    onHover: ({ hovering }) => {
      setIsHovered(hovering ?? false);
    },
    onClick: ({ shiftKey, metaKey, event }) => {
      event.stopPropagation();
      clickMarker(data, sources, allData, shiftKey, metaKey);
    },
    onDragStart: () => {
      onDragStart?.();
    },
    onDragEnd: () => {
      onDragEnd?.();
    },
  });

  return (
    <group ref={groupRef as any}>
      <Instance
        ref={instanceRefFg}
        position={[stamp, trackRender === TrackRender.Spline ? yPosition.get() : 0, 10]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[scaleX.get(), 1, 1]}
        // eslint-dissable-next-line
        color={fillColor.get()}
        {...(bind() as any)}
      />
      {/* Render a darker hexagon in the background */}
      <Instance
        ref={instanceRefBg}
        position={[stamp, trackRender === TrackRender.Spline ? yPosition.get() : 0, 2]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[scaleX.get() * bgScale.get(), 1, bgScale.get()]}
        // eslint-dissable-next-line
        color={backdropColor.get()}
      />
      {/* Render a vertical line at the stamp */}
      <Line
        ref={lineRef as any}
        points={[
          [stamp, height / -2 + 1, 1],
          [stamp, height / 2 - 1, 1],
        ]}
        color={baseColor}
        lineWidth={2}
        opacity={lineOpacity.get()}
        transparent
      />
    </group>
  );
});

const RENDERS_WITH_LINES = [TrackRender.Preview, TrackRender.Transition];

function getFillIndex(isHovered: boolean, isSelected: boolean, isReference: boolean): number {
  if (isReference) return 1;
  if (isSelected) return 0;
  if (isHovered) return 0.5;
  return 0;
}

function getBackdropIndex(isSelected: boolean, isReference: boolean): number {
  if (isReference) return 0.5;
  if (isSelected) return 1;
  return 0;
}
