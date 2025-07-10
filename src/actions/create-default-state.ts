import { TimeDisplay } from "@semio/ui";
import { AnimationData } from "../store-types";
// import { createDefaultAnimation } from "./create-default-animation";

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
  // const defaultAnimation = createDefaultAnimation();

  return {
    values: new Map(),
    velocities: new Map(),
    trackInterpolators: {},
    namespaceInfo: {},
    animations: {},
    tracks: {},
    visualizedAnimations: [],
    duration: 5000,
    framerate: 24,
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

    animatables: {},
  };
};
