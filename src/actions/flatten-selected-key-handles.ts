import type { AnimationData } from "../store-types";
import { buildFlattenedKeyTransitions } from "../functions/key-transition-ui-utils";
import { getNonEditableTrackIds } from "../functions/track-editability";
import { resolveSelectedKeyContexts } from "./update-selected-key-transitions";
import { updateKeypoint } from "./update-keypoint";

/**
 * Flatten the handles (derivative → 0) on every selected keypoint,
 * preserving each handle's Euclidean length. Already-flat sides (standard
 * easings that resolve to a flat delta, explicit handles with y≈0) are
 * left untouched; non-flat sides become explicit horizontal deltas.
 *
 * Pairing is set to Paired on any keypoint that was actually flattened
 * (both sides are now horizontal, so collinear by construction). Keypoints
 * whose handles were already flat are skipped entirely — we don't overwrite
 * an intentional Free pairing on already-flat keys.
 *
 * Readonly tracks are filtered out per-context so mixed selections (where
 * permissions changed mid-session leaving readonly entries in the
 * selection) only mutate writable ones.
 */
export function flattenSelectedKeyHandles(state: AnimationData): void {
  const contexts = resolveSelectedKeyContexts(state);
  if (contexts.length === 0) return;

  const { nonEditableIds } = getNonEditableTrackIds(state.instancedTrackSources);

  contexts.forEach((context) => {
    if (nonEditableIds.has(context.trackId)) return;
    const nextTransitions = buildFlattenedKeyTransitions(context);
    if (!nextTransitions) return;
    updateKeypoint(
      state,
      context.trackId,
      {
        id: context.point.id,
        transitions: nextTransitions,
      },
      false,
    );
  });
}
