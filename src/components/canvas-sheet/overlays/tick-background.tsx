import { memo, useMemo, useRef, useEffect } from "react";
import { strip } from "number-precision";
import { useShallow } from "zustand/react/shallow";
import * as THREE from "three";
import { Instances, Instance } from "@react-three/drei";
import { MotionValue, useMotionValueEvent } from "motion/react";
import { Theme } from "@semio/ui";
import { usePlayerStore } from "@semio/utils";
import { useAnimationStore, useInvariantScale } from "../../../hooks";
import type { AnimationData } from "../../../store-types";
import { Z } from "../../../constants";

interface TickBackgroundProps {
  height: number;
  theme?: Theme.Light | Theme.Dark;
  opacity?: number; // Opacity for the tick marks, default is 1 (fully opaque)
}

interface TickData {
  stamp: number;
  type: TickType;
}

export const TickBackground = memo(function TickBackground({
  height,
  theme = Theme.Light,
  opacity = 1,
}: TickBackgroundProps) {
  const instancesRef = useRef<THREE.InstancedMesh>(null);

  const duration = usePlayerStore(useShallow((state) => state.player.duration));
  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );
  const invariantScale = useInvariantScale();

  const frameCount = Math.floor(framerate * (duration / 1000));

  // Pre-calculate all ticks in a single loop using modulo arithmetic
  const allTicks = useMemo(() => {
    if (!Number.isFinite(frameCount) || frameCount <= 0 || framerate <= 0) {
      return [];
    }
    const ticks: TickData[] = [];

    for (let tickIndex = 0; tickIndex <= frameCount; tickIndex++) {
      const stamp = strip(tickIndex / frameCount);

      let tickType: TickType;
      if (tickIndex % framerate === 0) {
        tickType = TickType.Major; // Every second
      } else {
        tickType = TickType.Minor; // Every frame
      }

      ticks.push({
        stamp,
        type: tickType,
      });
    }
    return ticks;
  }, [frameCount, framerate]);

  const baseTickWidth = 1; // Base width that will be scaled by the parent group
  const instanceCount = allTicks.length;

  if (instanceCount === 0) return null;

  return (
    <Instances
      key={`tick-bg-${instanceCount.toString()}`}
      ref={instancesRef as any}
      limit={instanceCount}
      range={instanceCount}
    >
      <planeGeometry args={[baseTickWidth, height]} />
      <meshBasicMaterial toneMapped={false} opacity={opacity} transparent={opacity !== 1} />

      {allTicks.map((tick, index) => (
        <Tick
          key={`tick-${index.toString()}`}
          stamp={tick.stamp}
          tickType={tick.type}
          scale={invariantScale}
          theme={theme}
        />
      ))}
    </Instances>
  );
});

enum TickType {
  Major = "major",
  Minor = "minor",
}

const Tick = memo(function Tick({
  stamp,
  tickType,
  scale,
  theme = Theme.Light,
}: {
  stamp: number;
  tickType: TickType;
  scale: MotionValue<number>;
  theme?: Theme.Light | Theme.Dark;
}) {
  const instanceRef = useRef<THREE.InstancedMesh>(null);

  const color = useMemo(() => {
    switch (tickType) {
      case TickType.Minor:
        return "#737373";

      case TickType.Major:
        return theme === Theme.Light ? "#262626" : "#E4E4E4";
    }
  }, [tickType, theme]);

  useMotionValueEvent(scale, "change", (s) => {
    if (instanceRef.current) {
      instanceRef.current.scale.set(s, 1, 1);
    }
  });

  useEffect(() => {
    if (instanceRef.current) {
      instanceRef.current.scale.set(scale.get(), 1, 1);
    }
  }, [scale]);

  return <Instance ref={instanceRef as any} position={[stamp, 0, Z.Ticks]} color={color} />;
});
