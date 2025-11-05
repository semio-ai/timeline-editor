import { AnimatableValue, RawValue } from "@semio/utils";
import {
  Animation,
  DerivedSnapshot,
  DerivedTrackSnapshot,
  DragState,
  Namespace,
  SelectionState,
  SourceRow,
  Track,
  TrackKey,
  Violation,
} from "../types";
import { buildTrackKey } from "../utils/track-key";
import { computeTrackInterpolator } from "./compute-track-interpolator";
import { computeDerivativeInterpolator } from "./compute-derivative-interpolator";
import { computeTrackViolations } from "./compute-track-violations";
import { computeRowData } from "./compute-row-data";

export interface BuildDerivedSnapshotInputs {
  tracks: Record<string, Track<RawValue>>;
  namespaces: Record<string, Namespace>;
  animations: Record<string, Animation>;
  animatables: Record<string, AnimatableValue>;
  instancedTrackSources: Record<string, SourceRow>;
  dragState: DragState | undefined;
  selectionState: SelectionState;
  version?: number;
}

export function buildDerivedSnapshot(inputs: BuildDerivedSnapshotInputs): DerivedSnapshot {
  const { namespaces, animations, tracks, animatables } = inputs;

  const derivedTracks: Record<TrackKey, DerivedTrackSnapshot> = {};
  const canonicalViolationsByTrackKey: Record<TrackKey, Violation[]> = {};

  Object.values(namespaces).forEach((namespace) => {
    Object.values(namespace.animationInstances).forEach((instance) => {
      const animation = animations[instance.animationId];
      if (!animation) return;

      animation.tracks.forEach((trackId) => {
        const track = tracks[trackId];
        if (!track) return;

        const animatable = animatables[track.animatableId];
        if (!animatable) return;

        const trackKey = buildTrackKey(namespace.id, instance.id, trackId);
        const interpolator = computeTrackInterpolator(track, instance);
        const derivative = computeDerivativeInterpolator(interpolator, animation.duration);
        const canonicalViolations = computeTrackViolations(
          interpolator,
          animation.duration,
          trackId,
          namespace.id,
          instance.id,
          animatable,
        );

        derivedTracks[trackKey] = {
          canonical: {
            interpolator,
            derivative,
            violations: canonicalViolations,
          },
          metadata: {
            animatableId: track.animatableId,
            duration: animation.duration,
            timescale: instance.settings.timescale,
          },
        };

        canonicalViolationsByTrackKey[trackKey] = canonicalViolations;
      });
    });
  });

  const derivedRows: DerivedSnapshot["rows"] = {};
  Object.values(inputs.instancedTrackSources).forEach((sourceRow) => {
    const computed = computeRowData(
      sourceRow,
      inputs.tracks,
      canonicalViolationsByTrackKey,
      inputs.animatables,
      inputs.dragState,
      inputs.selectionState,
      {
        animations: inputs.animations,
        namespaces: inputs.namespaces,
      },
    );

    const trackKeys = sourceRow.data.map((data) =>
      buildTrackKey(data.namespaceId, data.instanceId, data.trackId),
    );

    derivedRows[sourceRow.id] = {
      id: sourceRow.id,
      trackKeys,
      computed,
    };
  });

  return {
    version: inputs.version,
    dragContext: inputs.dragState,
    tracks: derivedTracks,
    rows: derivedRows,
  };
}
