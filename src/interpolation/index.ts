import { InterpolationType } from "./interpolation";
import { linearInterpolationGenerator } from "./linear";

export const GENERATORS = {
  [InterpolationType.Linear]: linearInterpolationGenerator,
};
