import { describe, expect, it } from "vitest";
import { createDefaultState } from "../actions/create-default-state";
import {
  updateNewKeyTransitionDefaults,
  updateSelectedKeyTransitions,
} from "../actions/update-selected-key-transitions";
import { TransitionDirective } from "../store-types";
import { StandardTransitionType, TransitionPairing } from "../types";
import { buildTrackKey } from "../utils/track-key";
import type { AnimationData } from "../store-types";

describe("update-selected-key-transitions action", () => {
  it("converts inferred handles to explicit using deterministic segment geometry", () => {
    const state = createDefaultState();
    const trackId = "track-1";
    const keyA = "5e5f4065-9720-41d3-b8da-2a0cead68be1";
    const keyB = "2ae734b3-5f82-43fe-a813-5596c7079a31";
    const keyC = "430fbfe9-e91a-480c-82f0-d61948a22dda";

    state.tracks[trackId] = {
      id: trackId,
      name: "test",
      animatableId: "anim-1",
      points: [
        {
          id: keyA,
          stamp: 0.08333333333333333,
          value: 0.8599285654203119,
          transitions: { out: StandardTransitionType.Cubic },
        },
        {
          id: keyB,
          stamp: 0.4166666666666667,
          value: 2.958335227172671,
          transitions: {
            in: TransitionDirective.InferredAutoClamped,
            out: TransitionDirective.InferredAutoClamped,
            pairing: TransitionPairing.Paired,
          },
        },
        {
          id: keyC,
          stamp: 0.7583333333333333,
          value: 5.209633191836777,
          transitions: { in: StandardTransitionType.Cubic },
        },
      ],
    };

    state.selectionState.instanceId = "inst-1";
    state.selectionState.keypoints = new Map([[trackId, new Set([keyB])]]);

    state.namespaces = {
      ns: {
        id: "ns",
        name: "ns",
        animationInstances: {
          "inst-1": {
            id: "inst-1",
            animationId: "anim",
            settings: { offset: 0, timescale: 4, active: true },
          },
        },
      },
    } as unknown as AnimationData["namespaces"];

    // If conversion accidentally consumed render handles, these values would be persisted.
    // The action should ignore them and derive explicit deltas from track state.
    state.derivedSnapshot = {
      version: 1,
      tracks: {},
      rows: {
        row1: {
          id: "row1",
          data: [],
          computed: {
            virtualFrames: [],
            verticalBounds: { min: 0, max: 1 },
            violationSet: { primary: [], details: [] },
            selection: [],
            render: {
              markers: [],
              segments: [],
              handles: [
                {
                  id: `${keyB}-out`,
                  keypointId: keyB,
                  trackId,
                  trackKey: buildTrackKey("ns", "inst-1", trackId),
                  side: "out",
                  kind: "easing",
                  world: { x: 0.9, y: 0.1 },
                  effective: { x: 0.92, y: 0.08 },
                },
                {
                  id: `${keyB}-in`,
                  keypointId: keyB,
                  trackId,
                  trackKey: buildTrackKey("ns", "inst-1", trackId),
                  side: "in",
                  kind: "easing",
                  world: { x: 0.2, y: 4.4 },
                  effective: { x: 0.15, y: 4.6 },
                },
              ],
            },
          },
        },
      },
    } as unknown as AnimationData["derivedSnapshot"];

    updateSelectedKeyTransitions(state, {
      in: TransitionDirective.ExplicitHandles,
      out: TransitionDirective.ExplicitHandles,
    });

    const updated = state.tracks[trackId].points.find((point) => point.id === keyB);
    const inTransition = updated?.transitions?.in as { x: number; y: number };
    const outTransition = updated?.transitions?.out as { x: number; y: number };
    expect(inTransition.x).toBeCloseTo(-0.12730203724787165, 8);
    expect(inTransition.y).toBeCloseTo(-0.819687414386983, 8);
    expect(outTransition.x).toBeCloseTo(0.13643065634710644, 8);
    expect(outTransition.y).toBeCloseTo(0.8784658467525697, 8);
  });

  it("computes default pairing server-side when defaults are patched", () => {
    const state = createDefaultState();

    updateNewKeyTransitionDefaults(state, {
      in: StandardTransitionType.Linear,
      out: StandardTransitionType.Cubic,
    });
    expect(state.preferences.newKeyDefaults.transitions.pairing).toBe(TransitionPairing.Free);

    updateNewKeyTransitionDefaults(state, {
      in: StandardTransitionType.Cubic,
      out: StandardTransitionType.Cubic,
    });
    expect(state.preferences.newKeyDefaults.transitions.pairing).toBe(TransitionPairing.Paired);

    updateNewKeyTransitionDefaults(state, {
      in: StandardTransitionType.Linear,
      out: StandardTransitionType.Cubic,
      pairing: TransitionPairing.Paired,
    });
    expect(state.preferences.newKeyDefaults.transitions.pairing).toBe(TransitionPairing.Paired);
  });
});
