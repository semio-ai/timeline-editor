import { memo, useRef, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";

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
}: TrackTextProps) {
  return (
    <Suspense fallback={null}>
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
      />
    </Suspense>
  );
});

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
}: TrackTextProps) {
  const groupRef = useRef<any>(null);
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

  return (
    <group ref={groupRef} position={position} name={name}>
      <Text
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
