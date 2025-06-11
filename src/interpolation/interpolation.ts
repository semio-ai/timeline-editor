export enum InterpolationType {
  Linear = "linear",
  EaseInOutCubic = "easeInOutCubic",
}

export type InterpolationFunction<T> = (t: number) => T;
export type InterpolationFunctionGenerator<T> = (
  a: T,
  b: T,
  props?: any,
) => InterpolationFunction<T>;
