import { TimeDisplay } from "@semio/ui";
import { AnimationData } from "../store-types";
import { createDefaultAnimation } from "./create-default-animation";
import { createDefaultGraph } from "./temp-duplicate-functions";

export const createDefaultState = (): AnimationData => {
  const defaultAnimation = createDefaultAnimation();

  const defaultGraph = createDefaultGraph();

  return {
    values: new Map(),
    trackInterpolators: {},
    activeAnimation: defaultAnimation.id,
    animations: { [defaultAnimation.id]: defaultAnimation },
    tracks: {},
    visualizedAnimations: [defaultAnimation.id],
    duration: defaultAnimation.duration,
    framerate: 24,
    selectedKeyframe: undefined,
    expanded: false,
    timeDisplay: TimeDisplay.Frames,
    playerInterval: undefined,
    hoverpoint: 0,
    previews: [],
    preferences: {
      hoverDashedLine: false,
      dataPreviews: true,
    },
    trackSubscribers: [],
    animationSubscribers: [],
    violations: {},

    // THE FOLLOWING ENTRIES SHOULD BE REMOVED FOLLOWING THE DEMO
    activeGraph: defaultGraph.id,
    graphs: { [defaultGraph.id]: defaultGraph },
    nodes: {},
    animatables: {},
    controls: {},
  };
};
