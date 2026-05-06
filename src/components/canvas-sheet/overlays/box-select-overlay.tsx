import { memo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useShallow } from "zustand/shallow";
import { isOrthographicCamera } from "@semio/utils";
import { useAnimationStore, useColors } from "../../../hooks";
import type { AnimationData, BoxSelectState } from "../../../store-types";
import { Z } from "../../../constants";

const FILL_OPACITY = 0.25;
const BORDER_OPACITY = 0.5;
const CORNER_RADIUS_PX = 3;
const CORNER_SEGMENTS = 6;
/** Inset from the container edges for the timeline fixed-height mode. */
const FIXED_HEIGHT_MARGIN_PX = 3;

interface BoxSelectOverlayProps {
  /** Which origin this overlay renders for. Only shows when boxSelectState.origin matches. */
  origin?: BoxSelectState["origin"];
  /** When set, the overlay fills this fixed height (in world units) minus margins.
   *  Used for the timeline where Y doesn't discriminate between tracks. */
  fixedHeight?: number;
}

/**
 * Build a rounded rectangle as an array of [x, y] points centered at origin.
 * Corner radius is in world units (caller converts from pixels).
 */
function buildRoundedRectPoints(
  hw: number,
  hh: number,
  rx: number,
  ry: number,
  segments: number,
): [number, number][] {
  const pts: [number, number][] = [];
  const clampedRx = Math.min(rx, hw);
  const clampedRy = Math.min(ry, hh);

  // Bottom edge → bottom-right corner
  pts.push([-hw + clampedRx, -hh]);
  pts.push([hw - clampedRx, -hh]);
  for (let i = 1; i <= segments; i++) {
    const t = (i / segments) * (Math.PI / 2);
    pts.push([hw - clampedRx + Math.sin(t) * clampedRx, -hh + clampedRy - Math.cos(t) * clampedRy]);
  }

  // Right edge → top-right corner
  pts.push([hw, hh - clampedRy]);
  for (let i = 1; i <= segments; i++) {
    const t = (i / segments) * (Math.PI / 2);
    pts.push([hw - clampedRx + Math.cos(t) * clampedRx, hh - clampedRy + Math.sin(t) * clampedRy]);
  }

  // Top edge → top-left corner
  pts.push([-hw + clampedRx, hh]);
  for (let i = 1; i <= segments; i++) {
    const t = (i / segments) * (Math.PI / 2);
    pts.push([-hw + clampedRx - Math.sin(t) * clampedRx, hh - clampedRy + Math.cos(t) * clampedRy]);
  }

  // Left edge → bottom-left corner
  pts.push([-hw, -hh + clampedRy]);
  for (let i = 1; i <= segments; i++) {
    const t = (i / segments) * (Math.PI / 2);
    pts.push([
      -hw + clampedRx - Math.cos(t) * clampedRx,
      -hh + clampedRy - Math.sin(t) * clampedRy,
    ]);
  }

  return pts;
}

/**
 * Renders a semi-transparent rounded rectangle overlay during an active box-select gesture.
 *
 * The geometry is rebuilt each frame with constant pixel-space corner radius so
 * corners don't distort when the box is resized. Both fill and border share the
 * same rounded rect footprint.
 */
export const BoxSelectOverlay = memo(function BoxSelectOverlay({
  origin,
  fixedHeight,
}: BoxSelectOverlayProps) {
  const fillRef = useRef<THREE.Mesh>(null);
  const borderRef = useRef<THREE.LineLoop>(null);
  const boxRef = useRef<BoxSelectState | null>(null);

  const boxSelectState = useAnimationStore(
    useShallow((state: AnimationData) => state.boxSelectState),
  );
  boxRef.current =
    boxSelectState && (!origin || boxSelectState.origin === origin) ? boxSelectState : null;

  // Derive box color from the current selection — matches track color when
  // all selected keypoints belong to one track, otherwise falls back to default.
  const selectedTrackIds = useAnimationStore(
    useShallow((state: AnimationData) => {
      const keys = state.selectionState.keypoints;
      if (keys.size === 0) return [];
      return Array.from(keys.keys());
    }),
  );
  const selectionColor = useColors(selectedTrackIds);
  const colorRef = useRef(selectionColor);
  colorRef.current = selectionColor;

  // Reusable geometry objects — updated in place each frame
  const fillGeoRef = useRef<THREE.BufferGeometry>(new THREE.BufferGeometry());
  const borderGeoRef = useRef<THREE.BufferGeometry>(new THREE.BufferGeometry());

  useFrame(({ camera, size }) => {
    if (!isOrthographicCamera(camera)) return;
    const box = boxRef.current;
    const visible = box !== null;

    if (fillRef.current) fillRef.current.visible = visible;
    if (borderRef.current) borderRef.current.visible = visible;
    if (!box) return;

    const left = Math.min(box.startStamp, box.currentStamp);
    const right = Math.max(box.startStamp, box.currentStamp);

    // Read parent group transform once for world-to-local conversion and corner radius
    const parent = fillRef.current?.parent;
    const groupPosY = parent?.position.y ?? 0;
    const groupScaleY = parent?.scale.y ?? 1;

    let cy: number;
    let h: number;
    if (fixedHeight !== undefined) {
      const frustumHeight = camera.top - camera.bottom;
      const marginWorld = (FIXED_HEIGHT_MARGIN_PX / size.height) * frustumHeight;
      cy = 0;
      h = fixedHeight - marginWorld * 2;
    } else {
      // Convert world Y to local coordinates using the parent group's transform.
      // In spline mode the overlay group's position and scale are set dynamically.
      const topLocal = (Math.max(box.startY, box.currentY) - groupPosY) / groupScaleY;
      const bottomLocal = (Math.min(box.startY, box.currentY) - groupPosY) / groupScaleY;
      cy = (topLocal + bottomLocal) / 2;
      h = topLocal - bottomLocal;
    }

    const cx = (left + right) / 2;
    const w = right - left;

    if (w < 0.01 || h < 0.01) {
      if (fillRef.current) fillRef.current.visible = false;
      if (borderRef.current) borderRef.current.visible = false;
      return;
    }

    // Convert pixel corner radius to local units (accounting for parent group scale)
    const frustumWidth = camera.right - camera.left;
    const frustumHeight = camera.top - camera.bottom;
    const rx = (CORNER_RADIUS_PX / size.width) * frustumWidth;
    const ry = (CORNER_RADIUS_PX / size.height) * frustumHeight / groupScaleY;

    const hw = w / 2;
    const hh = h / 2;

    const points = buildRoundedRectPoints(hw, hh, rx, ry, CORNER_SEGMENTS);
    const zPos = Z.TrackSwitchingBoundary + 1;

    // Update border geometry (line loop)
    const borderPositions = new Float32Array(points.length * 3);
    points.forEach(([px, py], i) => {
      borderPositions[i * 3] = px;
      borderPositions[i * 3 + 1] = py;
      borderPositions[i * 3 + 2] = 0;
    });
    borderGeoRef.current.setAttribute("position", new THREE.BufferAttribute(borderPositions, 3));
    borderGeoRef.current.attributes.position.needsUpdate = true;
    if (borderRef.current) {
      borderRef.current.geometry = borderGeoRef.current;
      borderRef.current.position.set(cx, cy, zPos + 0.1);
    }

    // Update fill geometry (triangle fan from center)
    const vertCount = points.length + 1; // center + perimeter
    const fillPositions = new Float32Array(vertCount * 3);
    // Center vertex
    fillPositions[0] = 0;
    fillPositions[1] = 0;
    fillPositions[2] = 0;
    points.forEach(([px, py], i) => {
      const off = (i + 1) * 3;
      fillPositions[off] = px;
      fillPositions[off + 1] = py;
      fillPositions[off + 2] = 0;
    });

    const triCount = points.length;
    const indices = new Uint16Array(triCount * 3);
    for (let i = 0; i < triCount; i++) {
      indices[i * 3] = 0; // center
      indices[i * 3 + 1] = i + 1;
      indices[i * 3 + 2] = ((i + 1) % points.length) + 1;
    }

    fillGeoRef.current.setAttribute("position", new THREE.BufferAttribute(fillPositions, 3));
    fillGeoRef.current.setIndex(new THREE.BufferAttribute(indices, 1));
    fillGeoRef.current.attributes.position.needsUpdate = true;
    fillGeoRef.current.index!.needsUpdate = true;
    if (fillRef.current) {
      fillRef.current.geometry = fillGeoRef.current;
      fillRef.current.position.set(cx, cy, zPos);
      (fillRef.current.material as THREE.MeshBasicMaterial).color.set(colorRef.current);
    }
    if (borderRef.current) {
      (borderRef.current.material as THREE.LineBasicMaterial).color.set(colorRef.current);
    }
  });

  return (
    <>
      <mesh ref={fillRef} visible={false}>
        <bufferGeometry />
        <meshBasicMaterial
          color={selectionColor}
          transparent
          opacity={FILL_OPACITY}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineLoop ref={borderRef} visible={false}>
        <bufferGeometry />
        <lineBasicMaterial
          color={selectionColor}
          transparent
          opacity={BORDER_OPACITY}
          depthWrite={false}
          toneMapped={false}
        />
      </lineLoop>
    </>
  );
});
