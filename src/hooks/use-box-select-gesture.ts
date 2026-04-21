import { useCallback, useContext, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useShallow } from "zustand/shallow";
import { isOrthographicCamera } from "@semio/utils";
import { usePlayerStore } from "@semio/utils";
import { useTooltipStore } from "@semio/ui";
import type { AnimationActions, BoxSelectState } from "../store-types";
import { AnimationContext } from "../context";
import { useAnimationStore } from "./use-animation-store";

/** Minimum pointer movement (in screen pixels) before activating box-select. */
const ACTIVATION_THRESHOLD_PX = 3;

export interface BoxSelectGestureParams {
  viewId: string;
  topOffsetPx?: number;
  bottomOffsetPx?: number;
  trackHeightPx?: number;
}

/**
 * Unified hook for box-select gesture handling.
 *
 * Returns an `onPointerDown` handler to attach to any R3F mesh that should
 * initiate box-select (FrustumBackground, dedicated selection plane, etc.).
 * Uses the R3F intersection point for world coordinates.
 * Subsequent move/up tracked via window-level listeners.
 *
 * Interactive meshes (data points, carts, handles) call `stopPropagation()`
 * on their `onPointerDown`, preventing the event from reaching the box-select
 * surface — this is the coordination mechanism. No DOM-level listeners needed.
 */
export function useBoxSelectGesture(
  origin: BoxSelectState["origin"],
  params: BoxSelectGestureParams,
) {
  const { camera, gl, size } = useThree();
  const animationStore = useContext(AnimationContext);

  const { startBoxSelect, updateBoxSelect, commitBoxSelect, setBoxSelectPending } =
    useAnimationStore(
      useShallow((state: AnimationActions) => ({
        startBoxSelect: state.startBoxSelect,
        updateBoxSelect: state.updateBoxSelect,
        commitBoxSelect: state.commitBoxSelect,
        setBoxSelectPending: state.setBoxSelectPending,
      })),
    );

  const playing = usePlayerStore(useShallow((state) => state.player.running));

  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const canvasRef = useRef(gl.domElement);
  canvasRef.current = gl.domElement;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const actionsRef = useRef({ startBoxSelect, updateBoxSelect, commitBoxSelect, setBoxSelectPending });
  actionsRef.current = { startBoxSelect, updateBoxSelect, commitBoxSelect, setBoxSelectPending };

  const screenToWorld = useCallback((clientX: number, clientY: number): [number, number] => {
    const cam = cameraRef.current;
    if (!isOrthographicCamera(cam)) return [0, 0];
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    return [cam.left + nx * (cam.right - cam.left), cam.top - ny * (cam.top - cam.bottom)];
  }, []);

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (playing) return;
      if (e.button !== 0) return;
      // If another scene's box-select already claimed this pointer, skip.
      if (animationStore?.getState().boxSelectPending) return;
      // Don't start selection when an interactive overlay is open
      if (useTooltipStore.getState().hasInteractiveOverlay()) return;
      // Claim so other scenes (HUD/main) don't also start box-select
      actionsRef.current.setBoxSelectPending(true);

      // Use R3F intersection point for world coordinates
      const startWorld: [number, number] = [e.point.x, e.point.y];
      const startScreen: [number, number] = [e.clientX, e.clientY];
      const mode: BoxSelectState["mode"] = e.shiftKey
        ? "add"
        : e.ctrlKey || e.metaKey
          ? "toggle"
          : "replace";
      let activated = false;

      const onMove = (me: PointerEvent) => {
        const dx = me.clientX - startScreen[0];
        const dy = me.clientY - startScreen[1];
        const [currentX, currentY] = screenToWorld(me.clientX, me.clientY);

        if (!activated) {
          if (Math.sqrt(dx * dx + dy * dy) < ACTIVATION_THRESHOLD_PX) return;
          activated = true;
          actionsRef.current.startBoxSelect({
            origin,
            startStamp: startWorld[0],
            startY: startWorld[1],
            currentStamp: currentX,
            currentY,
            mode,
            initialKeypoints: new Map(),
            layout: {
              viewId: paramsRef.current.viewId,
              canvasHeight: sizeRef.current.height,
              topOffsetPx: paramsRef.current.topOffsetPx ?? 36,
              bottomOffsetPx: paramsRef.current.bottomOffsetPx ?? 108,
              trackHeightPx: paramsRef.current.trackHeightPx ?? 36,
            },
          });
        } else {
          actionsRef.current.updateBoxSelect(currentX, currentY);
        }
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        actionsRef.current.setBoxSelectPending(false);
        if (activated) {
          actionsRef.current.commitBoxSelect();
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [playing, origin, screenToWorld, animationStore],
  );

  return onPointerDown;
}
