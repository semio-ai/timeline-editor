import { RawValue } from "@semio/utils";
import { type AnimationData } from "../store-types";
import { Control, ProcessType, ProcessNode, Graph } from "../temp-duplicate-types";
import { updateAnimationKeypoint } from "./update-animation-keypoint";
import { createTrack } from "./create-track";
// import { GraphData } from "../store-types";

export function setValue(state: AnimationData, id: string, _namespace: string, value: RawValue) {
  // const lookupId = getLookup(namespace, id);
  const control =
    state.latestControl?.readId === id
      ? state.latestControl
      : Object.values(state.controls).find((ctrl) => ctrl.readId === id);
  if (control) {
    console.log("control already exists, reusing");
    // Update the existing track
    // We will for now assume that if the control exists, we have already created the track for it
    const trackId = control.writeId;
    updateAnimationKeypoint(state, state.activeAnimation, state.player.stamp, trackId, value);
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

    updateAnimationKeypoint(state, state.activeAnimation, state.player.stamp, track.id, value);
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
