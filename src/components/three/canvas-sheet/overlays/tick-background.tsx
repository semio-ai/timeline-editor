import { memo, useMemo, useRef } from "react";
import { strip } from "number-precision";
import { useShallow } from "zustand/react/shallow";
import * as THREE from "three";
import { Instances, Instance } from "@react-three/drei";
import { MotionValue, useMotionValueEvent } from "motion/react";
import { Theme } from "@semio/ui";
import { usePlayerStore } from "@semio/utils";
import { useAnimationStore, useInvariantScale } from "../../../../hooks";
import type { AnimationData } from "../../../../store-types";
import { Z } from "../../../../constants";

interface TickBackgroundProps {
  height: number;
  theme?: Theme.Light | Theme.Dark;
}

interface TickData {
  stamp: number;
  type: TickType;
}

export const TickBackground = memo(function TickBackground({
  height,
  theme = Theme.Light,
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

    console.log("ticks", ticks, ticks.length, frameCount, framerate, duration);
    return ticks;
  }, [frameCount, framerate, duration]);

  const baseTickWidth = 1; // Base width that will be scaled by the parent group

  return (
    <Instances ref={instancesRef as any}>
      <planeGeometry args={[baseTickWidth, height]} />
      <meshBasicMaterial toneMapped={false} />

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
      case TickType.Major:
        return "#737373";

      case TickType.Minor:
        return theme === Theme.Dark ? "#262626" : "#E4E4E4";
    }
  }, [tickType, theme]);

  useMotionValueEvent(scale, "change", (s) => {
    if (instanceRef.current) {
      instanceRef.current.scale.set(s, 1, 1);
    }
  });

  return <Instance ref={instanceRef as any} position={[stamp, 0, Z.Ticks]} color={color} />;
});
