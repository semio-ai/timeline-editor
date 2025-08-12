import { memo } from "react";

interface FrustumBackgroundProps {
  color: string;
  height: number;
  opacity?: number;
  position?: [number, number, number];
  onHoverChange?: (hovered: boolean) => void;
}

function InnerFrustumBackground({
  color,
  height,
  opacity = 1,
  position = [0.5, 0, -1],
  onHoverChange,
}: FrustumBackgroundProps) {
  return (
    <mesh
      position={position}
      onPointerOver={() => onHoverChange?.(true)}
      onPointerOut={() => onHoverChange?.(false)}
    >
      {/* Use a width of 3 to ensure full frustum coverage including padding */}
      <planeGeometry args={[3, height]} />
      <meshBasicMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        toneMapped={false}
      />
    </mesh>
  );
}

export const FrustumBackground = memo(InnerFrustumBackground);
