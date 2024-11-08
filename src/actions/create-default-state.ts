import { TimeDisplay } from "@semio/ui";
import { AnimationData } from "../store-types";
import { createDefaultAnimation } from "./create-default-animation";
import { createDefaultGraph } from "./temp-duplicate-functions";

/**
 * Creates the default state for an animation.
 *
 * This function initializes and returns an object representing the default state
 * of an animation, including various properties such as values, track interpolators,
 * active animation, animations, tracks, visualized animations, duration, framerate,
 * selected keyframe, expanded state, time display, player interval, hover point,
 * previews, preferences, track subscribers, animation subscribers, and violations.
 *
 * @returns [AnimationData] The default state of the animation.
 */
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
