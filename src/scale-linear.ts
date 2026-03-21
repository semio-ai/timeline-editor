import { scaleLinear } from "d3-scale";

export const defaultScaleLinear = scaleLinear().domain([0, 1]).range([0, 1]).clamp(true);

export type ScaleLinear = typeof defaultScaleLinear;
