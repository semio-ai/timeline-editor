import { Theme, stampToVisualTime } from "@semio/ui";
import { memo, useEffect, useRef, useCallback, useState } from "react";
import * as THREE from "three";
import { useFrame, ThreeEvent, useThree } from "@react-three/fiber";
import { clamp } from "lodash";
import { useShallow } from "zustand/react/shallow";
import { usePlayerStore, closestFrame, isOrthographicCamera } from "@semio/utils";
import {
  useMotionValue,
  easeOut,
  useSpring,
  useMotionValueEvent,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useCursor } from "@react-three/drei";
import { TrackText } from "../shared";
import { DynamicRoundedRect } from "../shared/rounded-rectangle-geometry";
import { useTriangleCaretGeometry } from "../shared/triangle-caret";
import {
  usePlayheadSpring,
  useAnimationStore,
  useAltKeyPressed,
  useInvariantScaleX,
  useTween,
  useDragGestures,
} from "../../../hooks";
import { Z } from "../../../constants";
import { AnimationData, AnimationActions } from "../../../store-types";
import { SemanticTime } from "../../../types";
import { centerViewportOnStamp, viewportMotion } from "../../../viewport-state";
import { getDataViewportFromFrustum } from "../../../viewport-utils";

const CONE_RADIUS = 4;
const SIDE_CARET_SIZE = 10;
const CARET_HEIGHT = 5;
const CART_HEIGHT = 20;
const CROSSFADE_DURATION = 0.15;
// Hide group entirely once it's faded below this threshold so it isn't
// raycast/hit-tested while invisible. Computed each frame from
// (mode-target || tweened opacity > threshold) so the group becomes visible
// the moment it's chosen, but stays visible through its fade-out.
const VISIBLE_THRESHOLD = 0.01;
// Drag/click meshes are widened by this many pixels beyond the visible box
// so the cart is comfortably grabbable at its rounded corners.
const HIT_PADDING_PX = 5;

// Replacement `Object3D.raycast` used to imperatively take a mesh out of
// three.js's intersection list while the cart is in arrow mode. See the
// usage in `useFrame` for why this is needed.
const NOOP_RAYCAST: THREE.Mesh["raycast"] = () => {};

export interface PlayheadCartProps {
  height?: number;
  theme?: Theme.Dark | Theme.Light;
  side: "top" | "bottom";
  fonts?: {
    mono?: string;
    ui?: string;
  };
  /**
   * When true, the cart's box is clamped to stay inside the local canvas's
   * data viewport, and edge indicators fade in when the playhead crosses
   * outside it. Top side ignores this flag — it always clamps and shows
   * edges (using the shared `viewportMotion`). This flag only affects the
   * bottom (minimap) cart, which has its own fixed data viewport derived
   * from the local camera. Default `false` preserves the legacy behavior:
   * the bottom cart sits exactly at the playhead and can be cropped at
   * t=0 / t=duration.
   */
  pinToViewport?: boolean;
}

const BASE_COLORS = {
  dark: {
    active: { cart: 1, text: "#000000" },
    inactive: { cart: 0.7, text: "#000000" },
  },
  light: {
    active: { cart: 0, text: "#ffffff" },
    inactive: { cart: 0.3, text: "#ffffff" },
  },
};

type CartMode = "cart" | "edge-left" | "edge-right";

function computeMode(
  stamp: number,
  dataLeft: number,
  dataRight: number,
  hasEdges: boolean,
): CartMode {
  if (!hasEdges) return "cart";
  if (stamp < dataLeft) return "edge-left";
  if (stamp > dataRight) return "edge-right";
  return "cart";
}

export const PlayheadCart = memo(function PlayheadCart({
  height = 36,
  theme = Theme.Light,
  side = "top",
  fonts,
  pinToViewport = false,
}: PlayheadCartProps) {
  const isTop = side === "top";

  // CART hierarchy (positions written each frame in useFrame):
  //   cartGroup            — world x = stamp (line + caret stay over the playhead)
  //     ├── cartStaticScale (scale.x = scaleX) — line + down/up caret in pixel space
  //     └── cartBoxGroup    — local x = (clampedX - stamp), so the box shifts inward at edges
  //         ├── cartBoxScale (scale.x = scaleX) — rect + drag handle in pixel space
  //         └── (text)                          — TrackText handles its own zoom-invariant scale
  const cartGroupRef = useRef<THREE.Group>(null);
  const cartStaticScaleRef = useRef<THREE.Group>(null);
  const cartBoxGroupRef = useRef<THREE.Group>(null);
  const cartBoxScaleRef = useRef<THREE.Group>(null);
  const cartLineRef = useRef<THREE.Mesh>(null);
  const cartCaretRef = useRef<THREE.Mesh>(null);
  const cartDragMeshRef = useRef<THREE.Mesh>(null);

  // EDGE group hierarchy (left and right are mirror images):
  //   edgeGroup            — world x = minCartX or maxCartX (the cart's most-clamped position)
  //     ├── edgeScale (scale.x = scaleX) — rect + side caret + click mesh in pixel space
  //     └── (text)                       — outside the scale group, same as cart
  const edgeLeftGroupRef = useRef<THREE.Group>(null);
  const edgeLeftScaleRef = useRef<THREE.Group>(null);
  const edgeRightGroupRef = useRef<THREE.Group>(null);
  const edgeRightScaleRef = useRef<THREE.Group>(null);

  const playheadSpring = usePlayheadSpring();
  const cartWidthSpring = useCartWidthSpring();
  const invariantScale = useInvariantScaleX();
  const cartHeightMotion = useMotionValue(CART_HEIGHT);

  // Compute the initial mode now so we can seed the opacity targets / group
  // visibility synchronously. Without this, the cart starts with `visible=false`
  // and only flips on once the tween fires its first "change" event — which
  // never happens on a steady-state mount where stamp is already in viewport.
  // For the bottom side, the data viewport isn't known until the camera is
  // available in useFrame; default to "cart" and let the first frame correct
  // it (the per-frame visibility recompute handles the brief mismatch).
  const hasEdges = isTop || pinToViewport;
  const initialMode = isTop
    ? computeMode(
        playheadSpring.get(),
        viewportMotion.get()[0],
        viewportMotion.get()[1],
        true,
      )
    : "cart";

  const [isDragging, setIsDragging] = useState(false);
  const altPressed = useAltKeyPressed();
  const { gl } = useThree();

  const { resetPlayer, playing } = usePlayerStore(
    useShallow((state) => ({
      resetPlayer: state.resetPlayer,
      playing: state.player.running,
    })),
  );

  const { framerate, addPreview, removePreview, previewCurrent } = useAnimationStore(
    useShallow((state: AnimationData & AnimationActions) => ({
      framerate: state.framerate as number,
      addPreview: state.addPreview,
      removePreview: state.removePreview,
      previewCurrent:
        state.previews.find((p) => p.semanticTime === SemanticTime.Current) !== undefined,
    })),
  );

  const verticalCaretGeometry = useTriangleCaretGeometry({
    height: CARET_HEIGHT,
    direction: isTop ? "down" : "up",
    leftSideSize: CONE_RADIUS,
    rightSideSize: CONE_RADIUS,
  });
  const leftCaretGeometry = useTriangleCaretGeometry({
    height: CARET_HEIGHT,
    direction: "left",
    leftSideSize: SIDE_CARET_SIZE,
    rightSideSize: SIDE_CARET_SIZE,
  });
  const rightCaretGeometry = useTriangleCaretGeometry({
    height: CARET_HEIGHT,
    direction: "right",
    leftSideSize: SIDE_CARET_SIZE,
    rightSideSize: SIDE_CARET_SIZE,
  });

  // Tracks whether the cart's drag/click handlers should fire. False when
  // the cart is faded out (arrow mode) — even though the parent group's
  // imperative `visible = false` is supposed to filter R3F pointer events,
  // during the cross-fade the group is still visible, and same-z raycast
  // ordering between this mesh and the edge click mesh isn't deterministic.
  // Without this gate, a tap on the edge indicator can race-trip the cart's
  // drag gesture (which `useDragGestures` activates on the slightest pointer
  // movement that accompanies any normal click) and call resetPlayer at the
  // click position — exactly the "click in arrow mode resets the playhead"
  // bug the user reported.
  const isCartActiveRef = useRef(initialMode === "cart");

  // Hold the cart drag mesh's original `raycast` function so we can swap it
  // for a no-op while the cart is faded out. Mirroring `visible` (either on
  // the group or the mesh itself) was not enough to keep R3F from
  // dispatching click events to this mesh — replacing `raycast` directly
  // removes it from three.js's intersection list at the source.
  const cartDragMeshOriginalRaycastRef = useRef<THREE.Mesh["raycast"] | null>(null);

  // Drag gestures (cart only — edge indicators are click-only)
  const dragHandlers = useDragGestures({
    disabled: playing,
    onDragStart: () => {
      setIsDragging(true);
    },
    onDrag: (position, altKey) => {
      if (altKey || altPressed) {
        resetPlayer(position);
      } else {
        resetPlayer(closestFrame(position, framerate));
      }
    },
    onDragEnd: () => {
      setIsDragging(false);
    },
  });

  useCursor(previewCurrent && !playing && !isDragging, "grab", "auto", gl.domElement);
  useCursor(isDragging, "grabbing", "auto", gl.domElement);

  // Color: brightness springs from active/inactive state, then transforms to hex.
  const cartBrightness = useSpring(
    previewCurrent ? BASE_COLORS[theme].active.cart : BASE_COLORS[theme].inactive.cart,
    { stiffness: 300, damping: 30 },
  );
  const textColor = previewCurrent
    ? BASE_COLORS[theme].active.text
    : BASE_COLORS[theme].inactive.text;
  useEffect(() => {
    cartBrightness.set(
      previewCurrent ? BASE_COLORS[theme].active.cart : BASE_COLORS[theme].inactive.cart,
    );
  }, [cartBrightness, theme, previewCurrent]);
  const cartColor = useTransform(cartBrightness, [0, 1], ["#000000", "#ffffff"]);

  useMotionValueEvent(cartColor, "change", (value) => {
    setMaterialColor(cartLineRef.current, value);
    setMaterialColor(cartCaretRef.current, value);
  });

  // Vertical positions (pixel space)
  const cartCenterY = isTop ? -height / 2 + 19 : height / 2 - 19;
  const linePixelY = isTop ? -height / 2 + 9 : height / 2 - 9;
  const caretPixelY = isTop ? linePixelY - 2 : linePixelY + 2;

  // ---- Cross-fade opacity ----
  // Targets seeded from initial mode so the right group is visible at mount.
  const cartOpacityTarget = useMotionValue(initialMode === "cart" ? 1 : 0);
  const edgeLeftOpacityTarget = useMotionValue(initialMode === "edge-left" ? 1 : 0);
  const edgeRightOpacityTarget = useMotionValue(initialMode === "edge-right" ? 1 : 0);
  const cartOpacity = useTween(cartOpacityTarget, {
    duration: CROSSFADE_DURATION,
    ease: easeOut,
  });
  const edgeLeftOpacity = useTween(edgeLeftOpacityTarget, {
    duration: CROSSFADE_DURATION,
    ease: easeOut,
  });
  const edgeRightOpacity = useTween(edgeRightOpacityTarget, {
    duration: CROSSFADE_DURATION,
    ease: easeOut,
  });

  useMotionValueEvent(cartOpacity, "change", (o) => {
    setMaterialOpacity(cartLineRef.current, o);
    setMaterialOpacity(cartCaretRef.current, o);
  });

  // Resize cart drag mesh as the cart's width spring changes.
  useMotionValueEvent(cartWidthSpring, "change", (w: number) => {
    if (cartDragMeshRef.current) cartDragMeshRef.current.scale.x = w + HIT_PADDING_PX;
  });

  // Per-frame: position groups, update mode targets, recompute visibility.
  useFrame(({ camera, size }) => {
    const stamp = playheadSpring.get();
    const scaleX = invariantScale.get();
    const halfCartWorld = (cartWidthSpring.get() / 2) * scaleX;
    // Box can hang ~7px past the data-viewport edge into the camera's padding
    // zone (camera frustum is data viewport ± TIMELINE_PADDING pixels). 7px
    // matches the legacy behavior — closer to the corner radius than to the
    // full padding so the box reaches the visible edge without being cropped.
    const edgeOvershootWorld = 7 * scaleX;

    // Resolve the data viewport that drives mode + clamp.
    //   Top: shared `viewportMotion` (the user-pannable data viewport).
    //   Bottom + pinToViewport: derive from the local camera frustum so the
    //     bottom cart pins to the minimap's own fixed range (which is
    //     independent of the top viewport).
    //   Bottom without pinToViewport: legacy behavior — never clamp, never
    //     switch to edge mode.
    let dataLeft: number;
    let dataRight: number;
    if (isTop) {
      [dataLeft, dataRight] = viewportMotion.get();
    } else if (pinToViewport && isOrthographicCamera(camera)) {
      const dv = getDataViewportFromFrustum(
        { left: camera.left, right: camera.right },
        Math.max(1, size.width),
      );
      dataLeft = dv.left;
      dataRight = dv.right;
    } else {
      // Bottom without pinning: never clamp, never switch to edge mode.
      dataLeft = -Infinity;
      dataRight = Infinity;
    }

    const mode = computeMode(stamp, dataLeft, dataRight, hasEdges);

    // The box shifts by `clampedX - stamp` so it remains readable when the
    // playhead approaches a viewport edge. Line + caret stay at `stamp`.
    const minCartX = dataLeft + halfCartWorld - edgeOvershootWorld;
    const maxCartX = dataRight - halfCartWorld + edgeOvershootWorld;
    const clampedX = hasEdges ? clamp(stamp, minCartX, Math.max(minCartX, maxCartX)) : stamp;

    if (cartGroupRef.current) cartGroupRef.current.position.x = stamp;
    if (cartBoxGroupRef.current) cartBoxGroupRef.current.position.x = clampedX - stamp;
    if (cartStaticScaleRef.current) cartStaticScaleRef.current.scale.x = scaleX;
    if (cartBoxScaleRef.current) cartBoxScaleRef.current.scale.x = scaleX;

    if (hasEdges) {
      if (edgeLeftGroupRef.current) edgeLeftGroupRef.current.position.x = minCartX;
      if (edgeRightGroupRef.current) edgeRightGroupRef.current.position.x = maxCartX;
      if (edgeLeftScaleRef.current) edgeLeftScaleRef.current.scale.x = scaleX;
      if (edgeRightScaleRef.current) edgeRightScaleRef.current.scale.x = scaleX;
    }

    cartOpacityTarget.set(mode === "cart" ? 1 : 0);
    edgeLeftOpacityTarget.set(mode === "edge-left" ? 1 : 0);
    edgeRightOpacityTarget.set(mode === "edge-right" ? 1 : 0);

    // Visibility: shown if currently chosen OR still fading out.
    const cartVisible = mode === "cart" || cartOpacity.get() > VISIBLE_THRESHOLD;
    if (cartGroupRef.current) {
      cartGroupRef.current.visible = cartVisible;
    }
    // Remove the cart drag mesh from raycasting in arrow mode. Mirroring
    // `visible` (group OR mesh) was insufficient to stop R3F dispatching
    // click events here; replacing the mesh's `raycast` function with a
    // no-op deterministically takes it out of three.js's intersection
    // list, so the edge mesh becomes the sole click target.
    if (cartDragMeshRef.current) {
      if (cartDragMeshOriginalRaycastRef.current === null) {
        cartDragMeshOriginalRaycastRef.current = cartDragMeshRef.current.raycast;
      }
      cartDragMeshRef.current.raycast = cartVisible
        ? cartDragMeshOriginalRaycastRef.current
        : NOOP_RAYCAST;
      cartDragMeshRef.current.visible = cartVisible;
    }
    // Gate the cart's drag/click handlers on `mode === "cart"`. See the
    // ref's declaration comment.
    isCartActiveRef.current = mode === "cart";
    if (edgeLeftGroupRef.current) {
      edgeLeftGroupRef.current.visible =
        mode === "edge-left" || edgeLeftOpacity.get() > VISIBLE_THRESHOLD;
    }
    if (edgeRightGroupRef.current) {
      edgeRightGroupRef.current.visible =
        mode === "edge-right" || edgeRightOpacity.get() > VISIBLE_THRESHOLD;
    }
  });

  const handleDoubleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (playing) return;
      centerViewportOnStamp();
      event.stopPropagation();
    },
    [playing],
  );

  const handlePointerEnter = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!previewCurrent && !playing) {
        addPreview({ semanticTime: SemanticTime.Current, stamp: 0 });
        event.stopPropagation();
      }
    },
    [previewCurrent, playing, addPreview],
  );

  const handlePointerLeave = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      removePreview((p) => p.semanticTime === SemanticTime.Current);
      event.stopPropagation();
    },
    [removePreview],
  );

  const handleEdgeClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    centerViewportOnStamp();
    event.stopPropagation();
  }, []);

  return (
    <>
      {/* CART (in-viewport): line + down/up caret pinned to stamp; box+text shifted to stay readable */}
      <group ref={cartGroupRef as any} visible={initialMode === "cart"}>
        {/* Line + caret in pixel space, anchored to actual playhead */}
        <group ref={cartStaticScaleRef as any} scale={[1, 1, 1]}>
          <mesh ref={cartLineRef as any} position={[0, linePixelY, Z.PlayheadCart]}>
            <planeGeometry args={[1.5, 18]} />
            <meshBasicMaterial
              color={cartColor.get()}
              toneMapped={false}
              transparent
              opacity={initialMode === "cart" ? 1 : 0}
            />
          </mesh>

          <mesh ref={cartCaretRef as any} position={[0, caretPixelY, Z.PlayheadCart]}>
            <primitive object={verticalCaretGeometry} />
            <meshBasicMaterial
              color={cartColor.get()}
              toneMapped={false}
              transparent
              opacity={initialMode === "cart" ? 1 : 0}
            />
          </mesh>
        </group>

        {/* Box + text + drag handle: shifted by (clampedX - stamp) */}
        <group ref={cartBoxGroupRef as any}>
          <group ref={cartBoxScaleRef as any} scale={[1, 1, 1]}>
            <DynamicRoundedRect
              position={[0, cartCenterY, Z.PlayheadCart]}
              widthMotion={cartWidthSpring}
              heightMotion={cartHeightMotion}
              radius={3}
              color={cartColor}
              opacityMotion={cartOpacity}
            />

            <mesh
              ref={cartDragMeshRef as any}
              position={[0, cartCenterY, 0.25]}
              // `isCartActiveRef` gates only NEW drags from starting in
              // arrow mode. An in-flight drag must always be allowed to
              // complete via Move/Up/Cancel — even if the drag itself
              // pushed the stamp past the viewport and flipped the mode
              // to arrow mid-drag — otherwise useGesture's internal
              // state stays "dragging" forever. The next hover that
              // returns to cart mode would then re-fire onDrag with the
              // pointer's current position, jumping the playhead.
              onPointerDown={(event) => {
                if (!isCartActiveRef.current) return;
                dragHandlers.onPointerDown(event);
              }}
              onPointerMove={dragHandlers.onPointerMove}
              onPointerUp={dragHandlers.onPointerUp}
              onPointerCancel={dragHandlers.onPointerCancel}
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={(event) => {
                if (!isCartActiveRef.current) return;
                handleDoubleClick(event);
              }}
              onPointerEnter={handlePointerEnter}
              onPointerLeave={handlePointerLeave}
              scale={[cartWidthSpring.get() + HIT_PADDING_PX, 1, 1]}
            >
              <planeGeometry args={[1, height * 0.8]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
          </group>

          {/* Text outside the scale group — TrackText handles its own
              zoom-invariant scaling. Z above PlayheadCart so it draws on top.
              `opacityMotion` ties the text fill opacity to the same cross-
              fade as the rect/caret/line — without it the text pops on/off
              at the visibility threshold while everything else dissolves. */}
          <group position={[0, cartCenterY, Z.PlayheadCart + 0.5]}>
            <PlayheadTime color={textColor} fonts={fonts} opacityMotion={cartOpacity} />
          </group>
        </group>
      </group>

      {/* EDGE INDICATORS (rendered when edge mode is reachable) */}
      {hasEdges && (
        <>
          <group ref={edgeLeftGroupRef as any} visible={initialMode === "edge-left"}>
            <group ref={edgeLeftScaleRef as any} scale={[1, 1, 1]}>
              <DynamicRoundedRect
                position={[0, cartCenterY, Z.PlayheadCart]}
                widthMotion={cartWidthSpring}
                heightMotion={cartHeightMotion}
                radius={3}
                color={cartColor}
                opacityMotion={edgeLeftOpacity}
              />
              <EdgeCaret
                geometry={leftCaretGeometry}
                widthMotion={cartWidthSpring}
                opacityMotion={edgeLeftOpacity}
                colorMotion={cartColor}
                side="left"
                centerY={cartCenterY}
              />
              <EdgeClickMesh
                widthMotion={cartWidthSpring}
                centerY={cartCenterY}
                height={height}
                onClick={handleEdgeClick}
              />
            </group>
            <group position={[0, cartCenterY, Z.PlayheadCart + 0.5]}>
              <PlayheadTime color={textColor} fonts={fonts} opacityMotion={edgeLeftOpacity} />
            </group>
          </group>

          <group ref={edgeRightGroupRef as any} visible={initialMode === "edge-right"}>
            <group ref={edgeRightScaleRef as any} scale={[1, 1, 1]}>
              <DynamicRoundedRect
                position={[0, cartCenterY, Z.PlayheadCart]}
                widthMotion={cartWidthSpring}
                heightMotion={cartHeightMotion}
                radius={3}
                color={cartColor}
                opacityMotion={edgeRightOpacity}
              />
              <EdgeCaret
                geometry={rightCaretGeometry}
                widthMotion={cartWidthSpring}
                opacityMotion={edgeRightOpacity}
                colorMotion={cartColor}
                side="right"
                centerY={cartCenterY}
              />
              <EdgeClickMesh
                widthMotion={cartWidthSpring}
                centerY={cartCenterY}
                height={height}
                onClick={handleEdgeClick}
              />
            </group>
            <group position={[0, cartCenterY, Z.PlayheadCart + 0.5]}>
              <PlayheadTime color={textColor} fonts={fonts} opacityMotion={edgeRightOpacity} />
            </group>
          </group>
        </>
      )}
    </>
  );
});

function setMaterialOpacity(mesh: THREE.Mesh | null, opacity: number): void {
  if (!mesh) return;
  (mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
}

function setMaterialColor(mesh: THREE.Mesh | null, color: string): void {
  if (!mesh) return;
  (mesh.material as THREE.MeshBasicMaterial).color.set(color);
}

// ---------------------------------------------------------------------------
// Edge indicator parts: caret + invisible click target.
// ---------------------------------------------------------------------------

const EdgeCaret = memo(function EdgeCaret({
  geometry,
  widthMotion,
  opacityMotion,
  colorMotion,
  side,
  centerY,
}: {
  geometry: THREE.BufferGeometry;
  widthMotion: MotionValue<number>;
  opacityMotion: MotionValue<number>;
  colorMotion: MotionValue<string>;
  side: "left" | "right";
  centerY: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Match the original "arrow mode" position: just outside the box edge with a
  // slight overlap so the caret's base appears flush against the rounded rect.
  const positionFor = useCallback(
    (w: number) => (side === "left" ? -w / 2 - 1 : w / 2 + 1),
    [side],
  );

  useMotionValueEvent(widthMotion, "change", (w) => {
    if (meshRef.current) meshRef.current.position.x = positionFor(w);
  });
  useMotionValueEvent(opacityMotion, "change", (o) => setMaterialOpacity(meshRef.current, o));
  useMotionValueEvent(colorMotion, "change", (c) => setMaterialColor(meshRef.current, c));

  return (
    <mesh
      ref={meshRef as any}
      position={[positionFor(widthMotion.get()), centerY, Z.PlayheadCart]}
    >
      <primitive object={geometry} />
      <meshBasicMaterial
        color={colorMotion.get()}
        toneMapped={false}
        transparent
        opacity={opacityMotion.get()}
      />
    </mesh>
  );
});

const EdgeClickMesh = memo(function EdgeClickMesh({
  widthMotion,
  centerY,
  height,
  onClick,
}: {
  widthMotion: MotionValue<number>;
  centerY: number;
  height: number;
  onClick: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { gl } = useThree();
  const [hovered, setHovered] = useState(false);

  useCursor(hovered, "pointer", "auto", gl.domElement);

  useMotionValueEvent(widthMotion, "change", (w) => {
    if (meshRef.current) meshRef.current.scale.x = w + HIT_PADDING_PX;
  });

  return (
    <mesh
      ref={meshRef as any}
      position={[0, centerY, 0.25]}
      scale={[widthMotion.get() + HIT_PADDING_PX, 1, 1]}
      // Stop pointerdown so the underlying ruler's playback gesture
      // (FrustumBackground in RulerRenderer) doesn't process this event
      // — without it the gesture chain can race the edge click and
      // confuse intent.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      onPointerEnter={(e) => {
        setHovered(true);
        e.stopPropagation();
      }}
      onPointerLeave={(e) => {
        setHovered(false);
        e.stopPropagation();
      }}
    >
      <planeGeometry args={[1, height * 0.8]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  );
});

// ---------------------------------------------------------------------------
// Cart width spring (in pixels): grows/shrinks with displayed time string.
// ---------------------------------------------------------------------------

function useCartWidthSpring() {
  const fontSize = 8;
  const altPressed = useAltKeyPressed();
  const [framerate, timeDisplay] = useAnimationStore(
    useShallow((s) => [s.framerate, s.timeDisplay]),
  );
  const [stamp, duration] = usePlayerStore(useShallow((s) => [s.player.stamp, s.player.duration]));
  const safeDuration = Number.isFinite(duration) ? duration : 0;

  const visualTime = stampToVisualTime(stamp, safeDuration, framerate, timeDisplay, altPressed);
  const size = (visualTime.length + 1) * fontSize;

  const width = useMotionValue(size);
  const widthTween = useTween(width, { duration: 0.07, ease: easeOut });

  useEffect(() => {
    width.set(size);
  }, [size, width]);

  return widthTween;
}

const PlayheadTime = memo(function PlayheadTime({
  color,
  fonts,
  opacityMotion,
}: {
  color: string;
  fonts?: { mono?: string; ui?: string };
  opacityMotion?: MotionValue<number>;
}) {
  const altPressed = useAltKeyPressed();
  const [framerate, timeDisplay] = useAnimationStore(
    useShallow((s) => [s.framerate, s.timeDisplay]),
  );
  const [stamp, duration] = usePlayerStore(useShallow((s) => [s.player.stamp, s.player.duration]));
  const safeDuration = Number.isFinite(duration) ? duration : 0;

  const visualTime = stampToVisualTime(stamp, safeDuration, framerate, timeDisplay, altPressed);

  return (
    <TrackText
      text={visualTime}
      color={color}
      fontSizePixels={10}
      name="cart-time-display"
      characters="0123456789:.-sf"
      font={fonts?.mono}
      opacityMotion={opacityMotion}
    />
  );
});
