import { memo, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import type { MotionValue } from "motion/react";
import type { Material } from "three";

export interface TrackTextProps {
  /** The text content to display */
  text: string;
  /** Text color */
  color?: string;
  /** Position in 3D space */
  position?: [number, number, number];
  /** Font size in pixels (will be converted to zoom-invariant world units) */
  fontSizePixels?: number;
  /** Font family */
  font?: string;
  /** Horizontal anchor point */
  anchorX?: "left" | "center" | "right";
  /** Vertical anchor point */
  anchorY?: "top" | "middle" | "bottom" | "top-baseline" | "bottom-baseline";
  /** Character set for optimization */
  characters?: string;
  /** Optional name for the text group */
  name?: string;
  /**
   * Optional opacity MotionValue. When provided, the text's fill opacity
   * tracks this motion value imperatively (no React re-renders). Used by
   * the playhead cart's cross-fade so the text dissolves alongside its
   * surrounding box/caret materials instead of popping at the visibility
   * threshold.
   */
  opacityMotion?: MotionValue<number>;
}

/**
 * A shared text component for Three.js that automatically handles:
 * - Zoom-invariant scaling (maintains constant pixel size)
 * - Built-in Suspense wrapping for font loading
 * - Optimized character sets for performance
 */
export const TrackText = memo(function TrackText({
  text,
  color = "#ffffff",
  position = [0, 0, 0],
  fontSizePixels = 10,
  font,
  anchorX = "center",
  anchorY = "middle",
  characters = "0123456789:.-sf",
  name,
  opacityMotion,
}: TrackTextProps) {
  return (
    <TrackTextInner
      text={text}
      color={color}
      position={position}
      fontSizePixels={fontSizePixels}
      font={font}
      anchorX={anchorX}
      anchorY={anchorY}
      characters={characters}
      name={name}
      opacityMotion={opacityMotion}
    />
  );
});

interface TextMeshLike {
  material?: Material | Material[];
}

const TrackTextInner = memo(function TrackTextInner({
  text,
  color,
  position,
  fontSizePixels,
  font,
  anchorX,
  anchorY,
  characters,
  name,
  opacityMotion,
}: TrackTextProps) {
  const groupRef = useRef<any>(null);
  const textRef = useRef<TextMeshLike | null>(null);
  const { size } = useThree();

  // Base font size in world units
  const baseFontSize = 0.01;

  // Update text scale to maintain constant pixel size regardless of zoom
  useFrame(({ camera }) => {
    if (!groupRef.current || !size.width || !size.height) return;

    const orthoCamera = camera as any;
    const currentFrustumHeight = orthoCamera.top - orthoCamera.bottom;
    const currentFrustumWidth = orthoCamera.right - orthoCamera.left;

    // Calculate scale factors for both axes
    const currentPixelsToWorldY = currentFrustumHeight / size.height;
    const currentPixelsToWorldX = currentFrustumWidth / size.width;
    const fontScaleFactorY = (fontSizePixels! * currentPixelsToWorldY) / baseFontSize;
    const fontScaleFactorX = (fontSizePixels! * currentPixelsToWorldX) / baseFontSize;

    // Apply scaling
    groupRef.current.scale.set(fontScaleFactorX, fontScaleFactorY, 1);
  });

  // Bind opacity directly to the troika text material so the cross-fade
  // dissolves the glyphs alongside the surrounding shapes. Imperative, no
  // re-renders. troika's text mesh material can be a single Material or
  // an array; we walk both shapes and set `.opacity` defensively.
  useEffect(() => {
    if (!opacityMotion) return;
    const apply = (o: number) => {
      const mesh = textRef.current;
      if (!mesh?.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        (mat as Material & { opacity?: number }).opacity = o;
      }
    };
    apply(opacityMotion.get());
    return opacityMotion.on("change", apply);
  }, [opacityMotion]);

  return (
    <group ref={groupRef} position={position} name={name}>
      <Text
        ref={textRef as any}
        font={font}
        fontSize={baseFontSize}
        color={color}
        anchorX={anchorX}
        anchorY={anchorY}
        characters={characters}
        material-transparent
      >
        {text}
      </Text>
    </group>
  );
});
