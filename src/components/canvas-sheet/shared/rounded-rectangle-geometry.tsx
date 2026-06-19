import { useMemo, useRef, memo, useEffect, useCallback } from "react";
import * as THREE from "three";
import { MotionValue, useMotionValueEvent } from "motion/react";

export interface RoundedRectangleGeometryProps {
  /** Corner radius (remains constant during morphing) */
  radius?: number;
  /** Number of segments per corner (higher = smoother corners) */
  segments?: number;
  /** Maximum width for morph target range */
  maxWidth?: number;
  /** Maximum height for morph target range */
  maxHeight?: number;
}

class RoundedRectangleGeometryImpl extends THREE.BufferGeometry {
  constructor(radius = 0.1, segments = 8, maxWidth = 2, maxHeight = 2) {
    super();

    // Generate vertices for the rounded rectangle
    const vertices: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];

    // Helper function to add a vertex
    let vertexIndex = 0;
    const addVertex = (x: number, y: number, u: number, v: number) => {
      vertices.push(x, y, 0);
      uvs.push(u, v);
      return vertexIndex++;
    };

    // Center vertex for triangulation
    const centerIndex = addVertex(0, 0, 0.5, 0.5);

    // Base geometry: minimal rectangle (just the corners)
    const baseWidth = radius * 2;
    const baseHeight = radius * 2;

    this.generateRectangleVertices(
      baseWidth,
      baseHeight,
      radius,
      segments,
      addVertex,
      vertices,
      indices,
      uvs,
      centerIndex,
    );

    // Set the geometry attributes
    this.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
    this.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
    this.setIndex(indices);

    // Create morph targets
    this.createMorphTargets(radius, segments, maxWidth, maxHeight);

    this.computeVertexNormals();
  }

  private generateRectangleVertices(
    width: number,
    height: number,
    radius: number,
    segments: number,
    addVertex: (x: number, y: number, u: number, v: number) => number,
    vertices: number[],
    indices: number[],
    uvs: number[],
    centerIndex: number,
  ): number[] {
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Calculate corner centers
    const cornerCenters = [
      { x: halfWidth - radius, y: halfHeight - radius }, // Top-right
      { x: -halfWidth + radius, y: halfHeight - radius }, // Top-left
      { x: -halfWidth + radius, y: -halfHeight + radius }, // Bottom-left
      { x: halfWidth - radius, y: -halfHeight + radius }, // Bottom-right
    ];

    // Generate corner vertices
    const cornerStartAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    const cornerVertices: number[][] = [[], [], [], []];
    const allVertexIndices: number[] = [];

    for (let corner = 0; corner < 4; corner++) {
      const center = cornerCenters[corner];
      const startAngle = cornerStartAngles[corner];

      for (let i = 0; i <= segments; i++) {
        const angle = startAngle + (i / segments) * (Math.PI / 2);
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius;

        // Calculate UV coordinates
        const u = (x + halfWidth) / width;
        const v = (y + halfHeight) / height;

        const vertIdx = addVertex(x, y, u, v);
        cornerVertices[corner].push(vertIdx);
        allVertexIndices.push(vertIdx);
      }
    }

    // Create faces for each corner
    for (let corner = 0; corner < 4; corner++) {
      const cornerVerts = cornerVertices[corner];
      for (let i = 0; i < cornerVerts.length - 1; i++) {
        indices.push(centerIndex, cornerVerts[i], cornerVerts[i + 1]);
      }
    }

    // Connect corners with straight edges
    for (let corner = 0; corner < 4; corner++) {
      const currentCorner = cornerVertices[corner];
      const nextCorner = cornerVertices[(corner + 1) % 4];

      const lastVertOfCurrent = currentCorner[currentCorner.length - 1];
      const firstVertOfNext = nextCorner[0];

      // Create triangle connecting to center
      indices.push(centerIndex, lastVertOfCurrent, firstVertOfNext);
    }

    return allVertexIndices;
  }

  private createMorphTargets(
    radius: number,
    segments: number,
    maxWidth: number,
    maxHeight: number,
  ) {
    // Create two morph targets:
    // Target 0: Width morph (base -> maxWidth)
    // Target 1: Height morph (base -> maxHeight)

    const baseWidth = radius * 2;
    const baseHeight = radius * 2;

    // Width morph target
    const widthMorphVertices = this.generateMorphVertices(maxWidth, baseHeight, radius, segments);

    // Height morph target
    const heightMorphVertices = this.generateMorphVertices(baseWidth, maxHeight, radius, segments);

    // Set morph targets
    this.morphAttributes.position = [
      new THREE.BufferAttribute(new Float32Array(widthMorphVertices), 3), // Width target
      new THREE.BufferAttribute(new Float32Array(heightMorphVertices), 3), // Height target
    ];
  }

  private generateMorphVertices(
    width: number,
    height: number,
    radius: number,
    segments: number,
  ): number[] {
    const morphVertices: number[] = [];
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Center vertex (unchanged)
    morphVertices.push(0, 0, 0);

    // Recalculate corner centers for morph dimensions
    const cornerCenters = [
      { x: halfWidth - radius, y: halfHeight - radius }, // Top-right
      { x: -halfWidth + radius, y: halfHeight - radius }, // Top-left
      { x: -halfWidth + radius, y: -halfHeight + radius }, // Bottom-left
      { x: halfWidth - radius, y: -halfHeight + radius }, // Bottom-right
    ];

    const cornerStartAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

    // Generate corner vertices with morph dimensions
    for (let corner = 0; corner < 4; corner++) {
      const center = cornerCenters[corner];
      const startAngle = cornerStartAngles[corner];

      for (let i = 0; i <= segments; i++) {
        const angle = startAngle + (i / segments) * (Math.PI / 2);
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius;

        morphVertices.push(x, y, 0);
      }
    }

    return morphVertices;
  }
}

export interface MorphableRoundedRectProps {
  /** Corner radius (constant) */
  radius?: number;
  /** Number of segments per corner */
  segments?: number;
  /** Maximum width for morph range */
  maxWidth?: number;
  /** Maximum height for morph range */
  maxHeight?: number;
  /** Width influence motion value (0-1) */
  widthInfluence?: MotionValue<number>;
  /** Height influence motion value (0-1) */
  heightInfluence?: MotionValue<number>;
  /** Material color */
  color?: string;
  /** Position in 3D space */
  position?: [number, number, number];
  /** Other mesh props */
  [key: string]: any;
}

/**
 * DynamicRoundedRect: A rounded rectangle whose width and height can be animated independently,
 * and whose corner radius remains visually constant (not stretched).
 *
 * This component updates the geometry's vertices in-place when width/height/radius change,
 * so the material/mesh do not need to be recreated.
 *
 * Accepts MotionValue(s) for width/height for direct animation without React rerenders.
 */
export const DynamicRoundedRect = memo(function MorphableRoundedRect({
  radius = 0.1,
  segments = 8,
  color = new MotionValue("#ffffff"),
  position = [0, 0, 0],
  widthMotion,
  heightMotion,
  opacityMotion,
  ...meshProps
}: {
  widthMotion: MotionValue<number>;
  heightMotion?: MotionValue<number>;
  radius: number;
  segments?: number;
  color?: MotionValue<string>;
  opacityMotion?: MotionValue<number>;
  position?: [number, number, number];
  [key: string]: any;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(new THREE.BufferGeometry());
  const lastDims = useRef<{ width: number; height: number }>({ width: 1, height: 1 });

  // Geometry update function
  const updateGeometry = useCallback(
    (width: number, height: number) => {
      const geom = generateRoundedRectGeometry(width, height, radius, segments);
      geometryRef.current.copy(geom);
      geometryRef.current.attributes.position.needsUpdate = true;
      if (geometryRef.current.attributes.normal)
        geometryRef.current.attributes.normal.needsUpdate = true;
      if (geometryRef.current.attributes.uv) geometryRef.current.attributes.uv.needsUpdate = true;
      lastDims.current = { width, height };
    },
    [radius, segments],
  );

  useMotionValueEvent(color, "change", (newColor) => {
    if (meshRef.current) {
      (meshRef.current.material as THREE.MeshBasicMaterial).color.set(newColor);
    }
  });

  useEffect(() => {
    if (!opacityMotion) return;
    const apply = (o: number) => {
      const mat = meshRef.current?.material as THREE.MeshBasicMaterial | undefined;
      if (!mat) return;
      mat.opacity = o;
    };
    apply(opacityMotion.get());
    return opacityMotion.on("change", apply);
  }, [opacityMotion]);

  useEffect(() => {
    // Initial geometry
    const width = widthMotion.get();
    const height = heightMotion ? heightMotion.get() : lastDims.current.height;
    updateGeometry(width, height);

    // Subscriptions
    const unsubWidth = widthMotion.on("change", (w) => {
      const h = heightMotion ? heightMotion.get() : lastDims.current.height;
      updateGeometry(w, h);
    });
    let unsubHeight: (() => void) | undefined;
    if (heightMotion) {
      unsubHeight = heightMotion.on("change", (h) => {
        const w = widthMotion.get();
        updateGeometry(w, h);
      });
    }
    return () => {
      unsubWidth();
      if (unsubHeight) unsubHeight();
    };
  }, [widthMotion, heightMotion, radius, segments, updateGeometry]);

  return (
    <mesh
      ref={meshRef as any}
      geometry={geometryRef.current as any}
      position={position}
      {...meshProps}
    >
      <meshBasicMaterial
        color={color.get()}
        toneMapped={false}
        transparent={opacityMotion !== undefined}
        opacity={opacityMotion ? opacityMotion.get() : 1}
      />
    </mesh>
  );
});

/**
 * Generates a flat rounded rectangle geometry with constant corner radius.
 * The rectangle is centered at (0,0), width extends along X, height along Y.
 */
export function generateRoundedRectGeometry(
  width: number,
  height: number,
  radius: number,
  segments = 8,
): THREE.BufferGeometry {
  // Clamp radius so it doesn't exceed half width/height
  const r = Math.min(radius, width / 2, height / 2);

  const shape = new THREE.Shape();

  // Start at top-right corner
  shape.absarc(width / 2 - r, height / 2 - r, r, 0, Math.PI / 2, false);
  shape.absarc(-width / 2 + r, height / 2 - r, r, Math.PI / 2, Math.PI, false);
  shape.absarc(-width / 2 + r, -height / 2 + r, r, Math.PI, 1.5 * Math.PI, false);
  shape.absarc(width / 2 - r, -height / 2 + r, r, 1.5 * Math.PI, 2 * Math.PI, false);
  shape.closePath();

  const geometry = new THREE.ShapeGeometry(shape, segments);
  // Center geometry at (0,0)
  geometry.translate(0, 0, 0);

  return geometry;
}

/**
 * React hook to create rounded rectangle geometry with morph targets
 */
export function useRoundedRectangleGeometry({
  radius = 0.1,
  segments = 8,
  maxWidth = 2,
  maxHeight = 2,
}: RoundedRectangleGeometryProps = {}) {
  return useMemo(() => {
    return new RoundedRectangleGeometryImpl(radius, segments, maxWidth, maxHeight);
  }, [radius, segments, maxWidth, maxHeight]);
}
