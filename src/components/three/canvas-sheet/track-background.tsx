import { cubicBezier, MotionValue, useMotionValueEvent } from "motion/react";
import { useEffect, useRef, memo } from "react";
import * as THREE from "three";
import { useTween } from "../../../hooks";

function InnerTrackBackground({
  emphasis = false,
  color,
  height,
}: {
  emphasis: boolean;
  color: string;
  height: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Set up the target opacity value
  const targetOpacity = emphasis ? 0.25 : 0.1;
  const opacityMotion = useRef(new MotionValue(targetOpacity));

  // Animate opacity with a cubic-bezier ease-in-out by default, or any motion easing function
  const opacityTween = useTween(opacityMotion.current, {
    ease: cubicBezier(0.645, 0.045, 0.355, 1.0),
    duration: 0.1, // seconds, adjust as needed
  });

  useEffect(() => {
    opacityMotion.current.set(targetOpacity);
  }, [emphasis, opacityMotion, targetOpacity]);

  useMotionValueEvent(opacityTween, "change", (newValue) => {
    if (meshRef.current?.material as THREE.MeshBasicMaterial) {
      (meshRef.current?.material as THREE.MeshBasicMaterial).opacity = newValue;
    }
  });

  return (
    <mesh ref={meshRef as any} position={[0.5, 0, -0.5]}>
      <planeGeometry args={[1, height]} />
      <meshBasicMaterial color={color} transparent opacity={0.1} />
    </mesh>
  );
}

export const TrackBackground = memo(InnerTrackBackground);
