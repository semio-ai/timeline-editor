export const springConfig = {
  duration: 0,
};

type EasingFunction = (t: number) => number;

/**
 * Creates a cubic bezier easing function.
 *
 * @param _p0 - The first control point (not used).
 * @param p1 - The second control point.
 * @param _p2 - The third control point (not used).
 * @param p3 - The fourth control point.
 * @returns An easing function that takes a time value `t` (ranging from 0 to 1) and returns the corresponding eased value.
 */
const cubicBezier = (_p0: number, p1: number, _p2: number, p3: number): EasingFunction => {
  return (t: number): number => {
    const cy = 3 * p1;
    const by = 3 * (p3 - p1) - cy;
    const ay = 1 - cy - by;

    const y = ((ay * t + by) * t + cy) * t;

    return y;
  };
};

export const easeConfig = {
  duration: 150,
  easing: cubicBezier(0.4, 0, 0.2, 1),
};
