import { TimeDisplay } from "@semio/ui";
import { newPlayer } from "@semio/utils";
import { AnimationData } from "../store-types";
import { createDefaultAnimation } from "./create-default-animation";
import { createDefaultGraph } from "./temp-duplicate-functions";

export const createDefaultState = (): AnimationData => {
  const defaultAnimation = createDefaultAnimation();

  const defaultGraph = createDefaultGraph();

  return {
    values: new Map(),
    interpolator: new Map(),
    activeAnimation: defaultAnimation.id,
    animations: { [defaultAnimation.id]: defaultAnimation },
    visualizedAnimations: [defaultAnimation.id],
    player: newPlayer(),
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
    },
    trackSubscribers: [],
    animationCache: new Map(),

    // THE FOLLOWING ENTRIES SHOULD BE REMOVED FOLLOWING THE DEMO
    activeGraph: defaultGraph.id,
    graphs: { [defaultGraph.id]: defaultGraph },
    nodes: {},
    animatables: {},
    controls: {},
  };
};
