import { forwardRef, type ForwardedRef } from "react";
import { clsx } from "clsx";
import type { GlyphProps as IconProps } from "@semio/ui";

export interface IconVectorTransitionCurveProps extends IconProps {
  className?: string;
}

const SAMPLE_COUNT = 18;
const X_MIN = 4;
const X_MAX = 28;
const Y_MIN = 4;
const Y_MAX = 28;

function easeInOutPow(power: number, t: number): number {
  if (t < 0.5) {
    return 2 ** (power - 1) * t ** power;
  }
  return 1 - (-2 * t + 2) ** power / 2;
}

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function easeInOutCirc(t: number): number {
  if (t < 0.5) {
    return (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2;
  }
  return (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2;
}

function easeInOutExpo(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  if (t < 0.5) {
    return 2 ** (20 * t - 10) / 2;
  }
  return (2 - 2 ** (-20 * t + 10)) / 2;
}

function easeInOutBack(t: number): number {
  const c1 = 1.70158;
  const c2 = c1 * 1.525;
  if (t < 0.5) {
    const value = 2 * t;
    return (value * value * ((c2 + 1) * value - c2)) / 2;
  }
  const value = 2 * t - 2;
  return (value * value * ((c2 + 1) * value + c2) + 2) / 2;
}

function toSvgPoint(t: number, value: number): { x: number; y: number } {
  const x = X_MIN + (X_MAX - X_MIN) * t;
  const clampedValue = Math.max(-0.12, Math.min(1.12, value));
  const normalized = (clampedValue + 0.12) / 1.24;
  const y = Y_MAX - (Y_MAX - Y_MIN) * normalized;
  return { x, y };
}

function buildCurvePath(curve: (t: number) => number): string {
  const points = Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    const t = index / (SAMPLE_COUNT - 1);
    return toSvgPoint(t, curve(t));
  });

  const [first, ...rest] = points;
  return `M${first.x.toFixed(3)},${first.y.toFixed(3)} ${rest
    .map((point) => `L${point.x.toFixed(3)},${point.y.toFixed(3)}`)
    .join(" ")}`;
}

function createTransitionIcon(displayName: string, curve: (t: number) => number) {
  const d = buildCurvePath(curve);

  const Icon = forwardRef(
    (
      { className, size, color, alt, mirrored, style, ...props }: IconVectorTransitionCurveProps,
      ref: ForwardedRef<SVGSVGElement>,
    ) => {
      return (
        <svg
          ref={ref}
          {...props}
          transform={mirrored ? "scale(-1, 1)" : undefined}
          xmlns="http://www.w3.org/2000/svg"
          width={size ?? "18px"}
          height={size ?? "18px"}
          className={clsx("icon", className)}
          viewBox="0 0 32 32"
          version="1.1"
          strokeLinecap="round"
          style={{
            fillRule: "evenodd",
            clipRule: "evenodd",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            ...style,
          }}
        >
          {alt ? <title>{alt}</title> : null}
          <path
            className="transition-[stroke]"
            d={d}
            fill="none"
            stroke={color ?? "currentColor"}
            strokeWidth={2}
          />
        </svg>
      );
    },
  );

  Icon.displayName = displayName;
  return Icon;
}

export const IconVectorLinear = createTransitionIcon("IconVectorLinear", (t) => t);
export const IconVectorSine = createTransitionIcon("IconVectorSine", easeInOutSine);
export const IconVectorQuad = createTransitionIcon("IconVectorQuad", (t) => easeInOutPow(2, t));
export const IconVectorCubic = createTransitionIcon("IconVectorCubic", (t) => easeInOutPow(3, t));
export const IconVectorQuart = createTransitionIcon("IconVectorQuart", (t) => easeInOutPow(4, t));
export const IconVectorQuint = createTransitionIcon("IconVectorQuint", (t) => easeInOutPow(5, t));
export const IconVectorCirc = createTransitionIcon("IconVectorCirc", easeInOutCirc);
export const IconVectorExpo = createTransitionIcon("IconVectorExpo", easeInOutExpo);
export const IconVectorBack = createTransitionIcon("IconVectorBack", easeInOutBack);
