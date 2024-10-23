export const springConfig = {
  // tension: 400,
  // friction: 20,
  // clamp: true,
  duration: 0,
};

type EasingFunction = (t: number) => number;

const cubicBezier = (_p0: number, p1: number, _p2: number, p3: number): EasingFunction => {
  // return a cubic bezier function with the above parameters (equivalent to css cubic-bezier)
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
