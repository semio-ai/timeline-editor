import { scaleLinear } from "@visx/scale";

const defaultScaleLinear = scaleLinear({
  domain: [0, 1],
  range: [0, 1],
  clamp: true,
});

export type ScaleLinear = typeof defaultScaleLinear;
