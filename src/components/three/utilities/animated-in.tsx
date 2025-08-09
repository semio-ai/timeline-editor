import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { useMotionValue, useMotionValueEvent } from "motion/react";
import { useTween, UseTweenConfig } from "../../../hooks/use-tween";

interface AnimatedInProps {
  children: React.ReactNode;
  from?: {
    scale?: [number, number, number];
    opacity?: number;
    position?: [number, number, number];
  };
  to?: {
    scale?: [number, number, number];
    opacity?: number;
    position?: [number, number, number];
  };
  duration?: number; // seconds
  delay?: number; // seconds
  ease?: (t: number) => number;
}

/**
 * AnimatedIn - Utility component for animating R3F elements in on mount.
 * Animates scale, opacity, and position from 'from' to 'to' values using useTween.
 */
export function AnimatedIn({
  children,
  from = { scale: [0, 0, 0], opacity: 0, position: [0, 0, 0] },
  to = { scale: [1, 1, 1], opacity: 1, position: [0, 0, 0] },
  duration = 0.5,
  delay = 0,
  ease,
}: AnimatedInProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [isVisible, setIsVisible] = useState(delay === 0);

  // Motion values for each property
  const scaleX = useMotionValue(from.scale?.[0] ?? 1);
  const scaleY = useMotionValue(from.scale?.[1] ?? 1);
  const scaleZ = useMotionValue(from.scale?.[2] ?? 1);
  const opacity = useMotionValue(from.opacity ?? 1);
  const posX = useMotionValue(from.position?.[0] ?? 0);
  const posY = useMotionValue(from.position?.[1] ?? 0);
  const posZ = useMotionValue(from.position?.[2] ?? 0);

  // Tweened values
  const tweenConfig: UseTweenConfig = { duration, ease };
  const tweenedScaleX = useTween(scaleX, tweenConfig);
  const tweenedScaleY = useTween(scaleY, tweenConfig);
  const tweenedScaleZ = useTween(scaleZ, tweenConfig);
  const tweenedOpacity = useTween(opacity, tweenConfig);
  const tweenedPosX = useTween(posX, tweenConfig);
  const tweenedPosY = useTween(posY, tweenConfig);
  const tweenedPosZ = useTween(posZ, tweenConfig);

  // Set initial group properties
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.scale.set(from.scale?.[0] ?? 1, from.scale?.[1] ?? 1, from.scale?.[2] ?? 1);
      groupRef.current.position.set(
        from.position?.[0] ?? 0,
        from.position?.[1] ?? 0,
        from.position?.[2] ?? 0,
      );
      groupRef.current.visible = from.opacity !== 0;
    }
  }, [from.scale, from.position, from.opacity]);

  // Start animation on mount (with optional delay)
  useEffect(() => {
    console.log("starting animations");

    const timeout = setTimeout(() => {
      setIsVisible(true);
      scaleX.set(to.scale?.[0] ?? 1);
      scaleY.set(to.scale?.[1] ?? 1);
      scaleZ.set(to.scale?.[2] ?? 1);
      opacity.set(to.opacity ?? 1);
      posX.set(to.position?.[0] ?? 0);
      posY.set(to.position?.[1] ?? 0);
      posZ.set(to.position?.[2] ?? 0);
    }, delay * 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- we only want to initiate this on load
  }, []);

  // Update scale
  useMotionValueEvent(tweenedScaleX, "change", (v) => {
    if (groupRef.current) groupRef.current.scale.x = v;
  });
  useMotionValueEvent(tweenedScaleY, "change", (v) => {
    if (groupRef.current) groupRef.current.scale.y = v;
  });
  useMotionValueEvent(tweenedScaleZ, "change", (v) => {
    if (groupRef.current) groupRef.current.scale.z = v;
  });

  // Update position
  useMotionValueEvent(tweenedPosX, "change", (v) => {
    if (groupRef.current) groupRef.current.position.x = v;
  });
  useMotionValueEvent(tweenedPosY, "change", (v) => {
    if (groupRef.current) groupRef.current.position.y = v;
  });
  useMotionValueEvent(tweenedPosZ, "change", (v) => {
    if (groupRef.current) groupRef.current.position.z = v;
  });

  // Update opacity
  useMotionValueEvent(tweenedOpacity, "change", (v) => {
    if (groupRef.current) {
      console.log("updating opacity to", v);
      // Set group visibility based on opacity
      groupRef.current.visible = v > 0;

      // For smoother opacity transitions, also set material opacity where possible
      groupRef.current.traverse((obj) => {
        if ((obj as THREE.Mesh).material) {
          const material = (obj as THREE.Mesh).material;
          if (Array.isArray(material)) {
            material.forEach((mat) => {
              if ("opacity" in mat) {
                mat.opacity = v;
                mat.transparent = true;
              }
            });
          } else if ("opacity" in material) {
            (material as any).opacity = v;
            (material as any).transparent = true;
          }
        }
      });
    }
  });

  return (
    <group ref={groupRef as any} visible={isVisible}>
      {children}
    </group>
  );
}
