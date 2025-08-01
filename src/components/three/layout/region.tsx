import type { ReactNode } from "react";
import { useMemo, forwardRef } from "react";
import type { GroupProps } from "@react-three/fiber";
import type { Group as ThreeGroup } from "three";
import { useRegion } from "./layout-context";
import type { Position2D, Dimensions2D } from "./types";

export interface RegionProps extends Omit<GroupProps, "position"> {
  regionId: string;
  children?: ReactNode;
  offset?: Position2D;
  scale?: number | [number, number, number];
  visible?: boolean;
}

/**
 * Base region component that positions content according to layout configuration
 */
export const Region = forwardRef<ThreeGroup, RegionProps>(
  (
    { regionId, children, offset = { x: 0, y: 0 }, scale = 1, visible = true, ...groupProps },
    ref,
  ) => {
    const bounds = useRegion(regionId);

    const position = useMemo((): [number, number, number] => {
      if (!bounds) return [0, 0, 0];
      return [bounds.position.x + offset.x, bounds.position.y + offset.y, 0];
    }, [bounds, offset.x, offset.y]);

    if (!bounds || !visible) {
      return null;
    }

    return (
      <group ref={ref as any} position={position} scale={scale} {...groupProps}>
        {children}
      </group>
    );
  },
);

Region.displayName = "Region";

export interface RegionBackgroundProps {
  regionId: string;
  color?: string;
  opacity?: number;
  visible?: boolean;
  zIndex?: number;
}

/**
 * Component for rendering region backgrounds
 */
export function RegionBackground({
  regionId,
  color = "#ffffff",
  opacity = 1,
  visible = true,
  zIndex = 0,
}: RegionBackgroundProps): ReactNode {
  const bounds = useRegion(regionId);

  if (!bounds || !visible) {
    return null;
  }

  return (
    <Region regionId={regionId}>
      <mesh position={[0, 0, zIndex]}>
        <planeGeometry args={[bounds.dimensions.width, bounds.dimensions.height]} />
        <meshBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} />
      </mesh>
    </Region>
  );
}

export interface RegionContentProps extends RegionProps {
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

/**
 * Component for rendering content within a region with optional padding
 */
export const RegionContent = forwardRef<ThreeGroup, RegionContentProps>(
  ({ regionId, padding, children, ...regionProps }, ref) => {
    const bounds = useRegion(regionId);

    const contentOffset = useMemo(() => {
      if (!padding || !bounds) return { x: 0, y: 0 };

      const { top = 0, right = 0, bottom = 0, left = 0 } = padding;

      return {
        x: (left - right) / 2,
        y: (bottom - top) / 2, // Inverted because Three.js Y increases upward
      };
    }, [padding, bounds]);

    return (
      <Region ref={ref} regionId={regionId} offset={contentOffset} {...regionProps}>
        {children}
      </Region>
    );
  },
);

RegionContent.displayName = "RegionContent";

export interface RegionBorderProps {
  regionId: string;
  color?: string;
  thickness?: number;
  visible?: boolean;
  zIndex?: number;
}

/**
 * Component for rendering region borders
 */
export function RegionBorder({
  regionId,
  color = "#000000",
  thickness = 1,
  visible = true,
  zIndex = 1,
}: RegionBorderProps): ReactNode {
  const bounds = useRegion(regionId);

  if (!bounds || !visible || thickness <= 0) {
    return null;
  }

  const { width, height } = bounds.dimensions;
  const halfThickness = thickness / 2;

  return (
    <Region regionId={regionId}>
      {/* Top border */}
      <mesh position={[0, height / 2 - halfThickness, zIndex]}>
        <planeGeometry args={[width, thickness]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Bottom border */}
      <mesh position={[0, -height / 2 + halfThickness, zIndex]}>
        <planeGeometry args={[width, thickness]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Left border */}
      <mesh position={[-width / 2 + halfThickness, 0, zIndex]}>
        <planeGeometry args={[thickness, height]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Right border */}
      <mesh position={[width / 2 - halfThickness, 0, zIndex]}>
        <planeGeometry args={[thickness, height]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </Region>
  );
}

export interface RegionOverlayProps {
  regionId: string;
  color?: string;
  opacity?: number;
  visible?: boolean;
  zIndex?: number;
  interactive?: boolean;
  onClick?: () => void;
  onHover?: (hovered: boolean) => void;
}

/**
 * Component for rendering interactive overlays within regions
 */
export function RegionOverlay({
  regionId,
  color = "rgba(0,0,0,0.1)",
  opacity = 0.5,
  visible = true,
  zIndex = 10,
  interactive = false,
  onClick,
  onHover,
}: RegionOverlayProps): ReactNode {
  const bounds = useRegion(regionId);

  if (!bounds || !visible) {
    return null;
  }

  return (
    <Region regionId={regionId}>
      <mesh
        position={[0, 0, zIndex]}
        onClick={interactive ? onClick : undefined}
        onPointerEnter={interactive && onHover ? () => onHover(true) : undefined}
        onPointerLeave={interactive && onHover ? () => onHover(false) : undefined}
      >
        <planeGeometry args={[bounds.dimensions.width, bounds.dimensions.height]} />
        <meshBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} />
      </mesh>
    </Region>
  );
}

export interface RegionDebugProps {
  regionId: string;
  showBounds?: boolean;
  showCenter?: boolean;
  showLabel?: boolean;
  labelColor?: string;
  boundsColor?: string;
  centerColor?: string;
  visible?: boolean;
}

/**
 * Debug component for visualizing region bounds and properties
 */
export function RegionDebug({
  regionId,
  showBounds = true,
  showCenter = true,
  showLabel = true,
  labelColor = "#ffffff",
  boundsColor = "#ff0000",
  centerColor = "#00ff00",
  visible = true,
}: RegionDebugProps): ReactNode {
  const bounds = useRegion(regionId);

  if (!bounds || !visible || process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <Region regionId={regionId}>
      {/* Bounds outline */}
      {showBounds && (
        <RegionBorder regionId={regionId} color={boundsColor} thickness={2} zIndex={100} />
      )}

      {/* Center point */}
      {showCenter && (
        <mesh position={[0, 0, 101]}>
          <circleGeometry args={[3, 8]} />
          <meshBasicMaterial color={centerColor} />
        </mesh>
      )}

      {/* Label */}
      {showLabel && (
        <mesh position={[-bounds.dimensions.width / 2 + 5, bounds.dimensions.height / 2 - 10, 102]}>
          {/* Text rendering would require additional setup like @react-three/drei Text */}
          <circleGeometry args={[2, 8]} />
          <meshBasicMaterial color={labelColor} />
        </mesh>
      )}
    </Region>
  );
}

/**
 * Utility hook for getting region dimensions within a component
 */
export function useRegionDimensions(regionId: string): Dimensions2D | undefined {
  const bounds = useRegion(regionId);
  return bounds?.dimensions;
}

/**
 * Utility hook for getting region position within a component
 */
export function useRegionPosition(regionId: string): Position2D | undefined {
  const bounds = useRegion(regionId);
  return bounds?.position;
}

/**
 * Higher-order component that automatically positions content within a region
 */
export function withRegion<P extends Record<string, any> = Record<string, any>>(
  Component: React.ComponentType<P>,
  regionId: string,
  options?: {
    offset?: Position2D;
    scale?: number | [number, number, number];
    padding?: RegionContentProps["padding"];
  },
) {
  const WrappedComponent = forwardRef<ThreeGroup, P>((props, ref) => {
    const RegionWrapper = options?.padding ? RegionContent : Region;

    return (
      <RegionWrapper
        ref={ref as any}
        regionId={regionId}
        offset={options?.offset}
        scale={options?.scale}
        padding={options?.padding}
      >
        <Component {...(props as P)} />
      </RegionWrapper>
    );
  });

  WrappedComponent.displayName = `withRegion(${Component.displayName || Component.name})`;

  return WrappedComponent;
}
