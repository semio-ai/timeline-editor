import { useMemo } from "react";
import * as THREE from "three";

export type CaretDirection = "up" | "down" | "left" | "right";

export interface TriangleCaretGeometryProps {
  width?: number; // Deprecated: use leftSideSize and rightSideSize instead
  height?: number;
  direction?: CaretDirection;
  leftSideSize?: number;
  rightSideSize?: number;
}

/**
 * Creates a triangle/caret geometry for use in orthographic views.
 * Returns a BufferGeometry that can be used with any mesh/material.
 */
export function createTriangleCaretGeometry({
  width = 8,
  height = 5,
  direction = "down",
  leftSideSize,
  rightSideSize,
}: TriangleCaretGeometryProps): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();

  // Use independent side sizes if provided, otherwise fall back to width/2
  const leftSize = leftSideSize !== undefined ? leftSideSize : width / 2;
  const rightSize = rightSideSize !== undefined ? rightSideSize : width / 2;

  let vertices: Float32Array;

  switch (direction) {
    case "down":
      // Triangle pointing down - centered around origin like ConeGeometry
      vertices = new Float32Array([
        -leftSize,
        height / 2,
        0, // top left
        0,
        -height / 2,
        0, // tip (bottom center)
        rightSize,
        height / 2,
        0, // top right
      ]);
      break;
    case "up":
      // Triangle pointing up - centered around origin like ConeGeometry
      vertices = new Float32Array([
        -leftSize,
        -height / 2,
        0, // bottom left
        rightSize,
        -height / 2,
        0, // bottom right
        0,
        height / 2,
        0, // tip (top center)
      ]);
      break;
    case "left":
      // Triangle pointing left - centered around origin like ConeGeometry
      vertices = new Float32Array([
        height / 2,
        -leftSize,
        0, // right bottom
        height / 2,
        rightSize,
        0, // right top
        -height / 2,
        0,
        0, // tip (left center)
      ]);
      break;
    case "right":
      // Triangle pointing right - centered around origin like ConeGeometry
      vertices = new Float32Array([
        -height / 2,
        -leftSize,
        0, // left bottom
        height / 2,
        0,
        0, // tip (right center)
        -height / 2,
        rightSize,
        0, // left top
      ]);
      break;
  }

  geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));

  // Add normals for proper rendering
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));

  // Add UV coordinates for texture mapping if needed
  const uvs = new Float32Array([0, 1, 1, 1, 0.5, 0]);
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

  return geo;
}

/**
 * React hook version that memoizes the geometry creation
 */
export function useTriangleCaretGeometry(props: TriangleCaretGeometryProps): THREE.BufferGeometry {
  return useMemo(() => createTriangleCaretGeometry(props), [props]);
}
