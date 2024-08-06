import { TimeDisplay } from "@semio/ui";
import { newPlayer } from "@semio/utils";
import { AnimationData } from "../store-types";
import { createDefaultAnimation } from "./create-default-animation";

export const createDefaultState = (): AnimationData => {
  const defaultAnimation = createDefaultAnimation();
  return {
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
  };
};
