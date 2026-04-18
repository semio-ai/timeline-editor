import { useCallback, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useShallow } from "zustand/shallow";
import { isOrthographicCamera } from "@semio/utils";
import { usePlayerStore } from "@semio/utils";
import { useAnimationStore } from "./use-animation-store";
import type { AnimationActions, AnimationData, BoxSelectState } from "../store-types";

/** Minimum pointer movement (in screen pixels) before activating box-select. */
const ACTIVATION_THRESHOLD_PX = 3;

/**
 * Hook for tracks-area box-select gesture handling.
 *
 * Attaches a native `pointerdown` listener to the canvas DOM element so it
 * catches clicks on ALL meshes (including inactive-instance row backgrounds
 * that block R3F propagation to the catch-all background). Subsequent
 * move/up events are tracked via window-level listeners.
 *
 * Should be called ONCE in the TracksRenderer.
 */
export function useBoxSelectGesture(origin: "tracks") {
  const { camera, gl } = useThree();

  const actionsRef = useRef<Pick<AnimationActions, "startBoxSelect" | "updateBoxSelect" | "cancelBoxSelect">>({
    startBoxSelect: () => {},
    updateBoxSelect: () => {},
    cancelBoxSelect: () => {},
  });
  const actions = useAnimationStore(
    useShallow((state: AnimationActions) => ({
      startBoxSelect: state.startBoxSelect,
      updateBoxSelect: state.updateBoxSelect,
      cancelBoxSelect: state.cancelBoxSelect,
    })),
  );
  actionsRef.current = actions;

  const playing = usePlayerStore(useShallow((state) => state.player.running));
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const boxSelectActiveRef = useRef(false);
  const boxSelectActive = useAnimationStore(
    useShallow((state: AnimationData) => state.boxSelectState !== null),
  );
  boxSelectActiveRef.current = boxSelectActive;

  useEffect(() => {
    const canvas = gl.domElement;

    let downState: {
      screenX: number;
      screenY: number;
      worldX: number;
      worldY: number;
      mode: BoxSelectState["mode"];
    } | null = null;
    let activated = false;
    let moveHandler: ((e: PointerEvent) => void) | null = null;
    let upHandler: (() => void) | null = null;

    function screenToWorld(clientX: number, clientY: number): [number, number] {
      const cam = cameraRef.current;
      if (!isOrthographicCamera(cam)) return [0, 0];
      const rect = canvas.getBoundingClientRect();
      const nx = (clientX - rect.left) / rect.width;
      const ny = (clientY - rect.top) / rect.height;
      return [
        cam.left + nx * (cam.right - cam.left),
        cam.top - ny * (cam.top - cam.bottom),
      ];
    }

    function onPointerDown(e: PointerEvent) {
      if (playingRef.current) return;
      if (e.button !== 0) return;
      // If the timeline HUD already started a box-select, don't interfere
      if (boxSelectActiveRef.current) return;

      const [worldX, worldY] = screenToWorld(e.clientX, e.clientY);

      downState = {
        screenX: e.clientX,
        screenY: e.clientY,
        worldX,
        worldY,
        mode: e.shiftKey ? "add" : e.ctrlKey || e.metaKey ? "toggle" : "replace",
      };
      activated = false;

      moveHandler = (me: PointerEvent) => {
        if (!downState) return;
        const dx = me.clientX - downState.screenX;
        const dy = me.clientY - downState.screenY;
        const [currentX, currentY] = screenToWorld(me.clientX, me.clientY);

        if (!activated) {
          if (Math.sqrt(dx * dx + dy * dy) < ACTIVATION_THRESHOLD_PX) return;
          activated = true;
          actionsRef.current.startBoxSelect({
            origin,
            startStamp: downState.worldX,
            startY: downState.worldY,
            currentStamp: currentX,
            currentY,
            mode: downState.mode,
          });
        } else {
          actionsRef.current.updateBoxSelect(currentX, currentY);
        }
      };

      upHandler = () => {
        if (moveHandler) window.removeEventListener("pointermove", moveHandler);
        if (upHandler) window.removeEventListener("pointerup", upHandler);
        moveHandler = null;
        upHandler = null;
        if (activated) {
          // TODO: commitBoxSelect
          actionsRef.current.cancelBoxSelect();
        }
        downState = null;
        activated = false;
      };

      window.addEventListener("pointermove", moveHandler);
      window.addEventListener("pointerup", upHandler);
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      if (moveHandler) window.removeEventListener("pointermove", moveHandler);
      if (upHandler) window.removeEventListener("pointerup", upHandler);
    };
  }, [gl.domElement, origin]);
}

/**
 * Hook for HUD-area box-select gesture handling (e.g., timeline).
 *
 * Returns an `onPointerDown` handler to attach to the HUD's FrustumBackground.
 * Uses the R3F intersection point for correct HUD-camera coordinates.
 * Subsequent move/up tracked via window listeners.
 *
 * @param origin - Which HUD area ("timeline").
 */
export function useHudBoxSelectGesture(origin: BoxSelectState["origin"]) {
  const { camera, gl } = useThree();

  const { startBoxSelect, updateBoxSelect, cancelBoxSelect } = useAnimationStore(
    useShallow((state: AnimationActions) => ({
      startBoxSelect: state.startBoxSelect,
      updateBoxSelect: state.updateBoxSelect,
      cancelBoxSelect: state.cancelBoxSelect,
    })),
  );

  const playing = usePlayerStore(useShallow((state) => state.player.running));

  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const canvasRef = useRef(gl.domElement);
  canvasRef.current = gl.domElement;
  const actionsRef = useRef({ startBoxSelect, updateBoxSelect, cancelBoxSelect });
  actionsRef.current = { startBoxSelect, updateBoxSelect, cancelBoxSelect };

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const cam = cameraRef.current;
      if (!isOrthographicCamera(cam)) return [0, 0];
      const rect = canvasRef.current.getBoundingClientRect();
      const nx = (clientX - rect.left) / rect.width;
      const ny = (clientY - rect.top) / rect.height;
      return [
        cam.left + nx * (cam.right - cam.left),
        cam.top - ny * (cam.top - cam.bottom),
      ];
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (playing) return;
      if (e.button !== 0) return;

      const startWorld: [number, number] = [e.point.x, e.point.y];
      const startScreen: [number, number] = [e.clientX, e.clientY];
      const mode: BoxSelectState["mode"] = e.shiftKey ? "add" : e.ctrlKey || e.metaKey ? "toggle" : "replace";
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
          });
        } else {
          actionsRef.current.updateBoxSelect(currentX, currentY);
        }
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (activated) {
          actionsRef.current.cancelBoxSelect();
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [playing, origin, screenToWorld],
  );

  return onPointerDown;
}
