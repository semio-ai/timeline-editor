import type { PlayerData } from "@semio/utils";
import { shallow } from "zustand/shallow";
import { viewportMotion, getFittedViewport } from "../viewport-state";
import type {
  AnimationApi,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";

/** Stamp must be within this many ms of viewport center to trigger a snap. */
const SNAP_THRESHOLD_MS = 10;

/**
 * Follow-playhead policy. Subscribes to player stamp/running and writes the
 * viewport MotionValue:
 *
 * - If the stamp is within SNAP_THRESHOLD_MS of viewport center (either
 *   before or after this tick), recenter the viewport on the new stamp.
 *   This fires every tick during continuous playback once aligned.
 * - Otherwise, while running, LERP the viewport center toward stamp at
 *   40% per tick. Recovers smoothly after a manual pan during play.
 *
 * Also handles the duration-rescale heuristic from the old player store:
 * if the viewport's right edge sat exactly at the old duration, rescale
 * it to the new duration (used to keep "show full timeline" intact when
 * project length changes).
 */
export function viewportFollow(
  _api: AnimationApi,
  _set: AnimationStoreSetter,
  get: AnimationStoreGetter,
): () => void {
  const player = get().playerStore;
  let prevStamp = player.getState().player.stamp;
  let prevDuration = player.getState().player.duration;

  const unsubFollow = player.subscribe(
    (state: PlayerData) => ({
      stamp: state.player.stamp,
      running: state.player.running,
    }),
    ({ stamp, running }) => {
      const oldStamp = prevStamp;
      prevStamp = stamp;

      if (!running) return;

      const viewport = viewportMotion.get();
      const center = (viewport[0] + viewport[1]) / 2;

      const oldNearCenter = Math.abs(oldStamp - center) < SNAP_THRESHOLD_MS;
      const newNearCenter = Math.abs(stamp - center) < SNAP_THRESHOLD_MS;

      if (oldNearCenter || newNearCenter) {
        viewportMotion.set(getFittedViewport(stamp, viewport));
        return;
      }

      // Drift smoothing: viewport center moves 40% of the way toward stamp
      // each tick. Recovers from manual pan during play.
      const w = viewport[1] - viewport[0];
      const newCenter = center * 0.6 + stamp * 0.4;
      viewportMotion.set([newCenter - w / 2, newCenter + w / 2]);
    },
    { equalityFn: shallow },
  );

  const unsubDuration = player.subscribe(
    (state: PlayerData) => state.player.duration,
    (newDuration) => {
      const oldDuration = prevDuration;
      prevDuration = newDuration;
      if (oldDuration <= 0 || newDuration <= 0) return;
      const v = viewportMotion.get();
      if (Math.abs(v[1] - oldDuration) < 1) {
        // Pin the right edge to the new duration. Normally the left edge
        // is preserved (grow case extends the viewport rightward) — but
        // if the user had panned the left edge past the new duration
        // (e.g. panned to [6000, 8000] in an 8000ms animation, then
        // duration shrinks to 5000), preserving left gives [6000, 5000],
        // an INVERTED viewport (left > right). That sign-flip propagates
        // through `getDataViewportFromFrustum` into every drag in
        // `useDragGestures`, making the cart track in the opposite
        // direction of the cursor. In that case shift the left edge back
        // so width is preserved when possible.
        let newLeft = v[0];
        if (newLeft > newDuration) {
          const width = v[1] - v[0];
          newLeft = Math.max(0, newDuration - width);
        }
        viewportMotion.set([newLeft, newDuration]);
      }
    },
  );

  return () => {
    unsubFollow();
    unsubDuration();
  };
}
