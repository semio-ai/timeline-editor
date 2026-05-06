import type { AnimationData, AnimationStoreSetter } from "../store-types";
import { Preview, SemanticTime } from "../types";

export function addPreview(set: AnimationStoreSetter, preview: Preview): void {
  set((state: AnimationData) => ({
    previews: [...state.previews, preview],
  }));
}

export function removePreview(
  set: AnimationStoreSetter,
  evaluator: (preview: Preview) => boolean,
): void {
  set((state: AnimationData) => ({
    previews: state.previews.filter((p) => !evaluator(p)),
  }));
}

export function updatePreview(
  set: AnimationStoreSetter,
  evaluator: (preview: Preview) => boolean,
  preview: Partial<Preview>,
): void {
  set((state: AnimationData) => ({
    previews: state.previews.map((p) => (evaluator(p) ? { ...p, ...preview } : p)),
  }));
}

export function updateHoverpointPreview(
  set: AnimationStoreSetter,
  value: number | null,
): void {
  set((state: AnimationData) => {
    if (value !== null) {
      const currentIdx = state.previews.findIndex((p) => p.semanticTime === SemanticTime.Hover);
      if (currentIdx < 0) {
        return {
          previews: [...state.previews, { semanticTime: SemanticTime.Hover, stamp: value }],
        };
      }
      return {
        previews: state.previews.map((p, idx) =>
          idx === currentIdx ? { semanticTime: SemanticTime.Hover, stamp: value } : p,
        ),
      };
    }
    return { previews: state.previews.filter((p) => p.semanticTime !== SemanticTime.Hover) };
  });
}
