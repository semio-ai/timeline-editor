import { RawValue, usePlayerStore } from "@semio/utils";
import { type AnimationData } from "../store-types";
import { Control, ProcessType, ProcessNode, Graph } from "../types";
import { updateKeypoint } from "./update-keypoint";
import { createTrack } from "./create-track";

export function setValue(state: AnimationData, id: string, _namespace: string, value: RawValue) {
  const timestamp = usePlayerStore.getState().player.stamp;
  const control =
    state.latestControl?.readId === id
      ? state.latestControl
      : Object.values(state.controls).find((ctrl) => ctrl.readId === id);
  if (control) {
    console.log("control already exists, reusing");
    // Update the existing track
    // We will for now assume that if the control exists, we have already created the track for it
    const trackId = control.writeId;
    updateKeypoint(state, trackId, { value, stamp: timestamp });
    state.latestControl = control;
  } else {
    console.log("control doesn't exist, creating new track and control");
    // fetch the source animatable
    const sourceAnimatable = state.animatables[id];

    // Create a new track
    const track = createTrack(state, state.activeAnimation, {
      name: sourceAnimatable.name,
    });

    const newControl: Control = {
      id: crypto.randomUUID(),
      readId: id,
      writeId: track.id,
      settings: {},
    };

    // Create a new node

    const newNode: ProcessNode = {
      id: crypto.randomUUID(),
      type: ProcessType.Identity,
      inId: track.id,
      outId: id,
    };
    state.nodes[newNode.id] = newNode;
    state.nodes = { ...state.nodes, [newNode.id]: newNode };
    state.graphs[state.activeGraph].nodes.push(newNode.id);
    state.controls[newControl.id] = newControl;
    state.latestControl = newControl;

    updateKeypoint(state, track.id, { value, stamp: timestamp });
  }
  // console.log("Setting value", lookupId, value);
  // state.values.set(lookupId, value);
}

export function updateControlColor(state: AnimationData, controlId: string, color: string) {
  if (state.controls[controlId]) {
    state.controls[controlId].settings.color = color;
  }
}

export function createDefaultGraph(): Graph {
  return {
    id: "Unsaved Default Graph",
    name: "New Graph",
    nodes: [],
    instances: {
      default: null,
    },
  };
}
