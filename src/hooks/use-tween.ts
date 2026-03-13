import { useEffect } from "react";
import { useMotionValue, MotionValue } from "motion/react";
import { cubicBezier } from "motion";

// Default cubic-bezier for ease-in-out-cubic
const defaultCubicBezier = cubicBezier(0.645, 0.045, 0.355, 1.0);

export interface UseTweenConfig {
  duration?: number; // seconds
  ease?: (t: number) => number;
  epsilon?: number; // threshold for stopping animation
}

/**
 * useTween - animates a motion value to a target value using a custom easing function.
 * Returns a motion value that updates over time according to the easing curve.
 *
 * @param sourceMotionValue - The motion value to animate from.
 * @param config - { duration, ease }
 * @returns tweenedMotionValue
 */

// AttachTween function, similar to attachSpring in motion
function attachTween(
  source: MotionValue<number>,
  target: MotionValue<number>,
  { duration = 0.5, ease = defaultCubicBezier, epsilon = 0.001 }: UseTweenConfig,
) {
  let animationFrame: number | null = null;
  let startValue = target.get();
  let endValue = source.get();
  let startTime = 0;

  function stopTween() {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function startTween(newTarget: number) {
    stopTween();
    startValue = target.get();
    endValue = newTarget;
    startTime = performance.now();

    function animate() {
      const now = performance.now();
      const elapsed = (now - startTime) / 1000; // seconds
      const t = Math.min(elapsed / duration, 1);
      const easedT = ease(t);

      const currentValue = startValue + (endValue - startValue) * easedT;
      target.set(currentValue);

      if (t < 1 && Math.abs(currentValue - endValue) > epsilon) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        target.set(endValue);
        animationFrame = null;
      }
    }

    animationFrame = requestAnimationFrame(animate);
  }

  // Subscribe to changes in the source value
  const unsubscribe = source.on("change", (newTarget: number) => {
    if (Math.abs(newTarget - target.get()) > epsilon) {
      startTween(newTarget);
    } else {
      target.set(newTarget);
      stopTween();
    }
  });

  // Initial start
  startTween(source.get());

  // Return a cleanup function
  return () => {
    unsubscribe();
    stopTween();
  };
}

export function useTween(sourceMotionValue: MotionValue<number>, config: UseTweenConfig = {}) {
  const tweened = useMotionValue(sourceMotionValue.get());

  useEffect(() => {
    const cleanup = attachTween(sourceMotionValue, tweened, config);
    return cleanup;
    // Only re-run if config or sourceMotionValue changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ignore the tweened value
  }, [sourceMotionValue, config.duration, config.ease, config.epsilon, config]);

  return tweened;
}
