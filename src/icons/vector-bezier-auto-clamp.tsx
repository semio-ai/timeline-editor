import { forwardRef, type ForwardedRef } from "react";
import { clsx } from "clsx";
import type { GlyphProps as IconProps } from "@semio/ui";

export interface IconVectorBezierAutoClampProps extends IconProps {
  className?: string;
}

const IconVectorBezierAutoClamp = forwardRef(
  (
    { className, size, color, alt, mirrored, style, ...props }: IconVectorBezierAutoClampProps,
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
        <g id="Curve">
          <path
            className="transition-[stroke]"
            d="M29.333,13.174c-12.396,-7 -15.667,12.608 -26.667,5.674"
            fill="none"
            fillRule="nonzero"
            stroke={color ?? "currentColor"}
            strokeWidth={2}
          />
          <path
            id="Hex"
            className="transition-[fill]"
            fill={color ?? "currentColor"}
            d="M16,12.265c0.41,0 3.096,1.518 3.301,1.866c0.205,0.348 0.205,3.385 0,3.733c-0.205,0.348 -2.89,1.866 -3.301,1.866c-0.41,0 -3.096,-1.518 -3.301,-1.866c-0.205,-0.348 -0.205,-3.385 0,-3.733c0.205,-0.348 2.89,-1.866 3.301,-1.866Z"
          />
        </g>
        <g id="Handles" opacity="0.6">
          <path
            className="transition-[stroke]"
            d="M7.501,27.342l16.998,-22.684"
            fill="none"
            fillRule="nonzero"
            stroke={color ?? "currentColor"}
            strokeWidth={2}
          />
          <circle
            className="transition-[fill]"
            cx="24.499"
            cy="4.658"
            r="2.5"
            fill={color ?? "currentColor"}
          />
          <circle
            className="transition-[fill]"
            cx="7.501"
            cy="27.342"
            r="2.5"
            fill={color ?? "currentColor"}
          />
        </g>
      </svg>
    );
  },
);

IconVectorBezierAutoClamp.displayName = "IconVectorBezierAutoClamp";

export { IconVectorBezierAutoClamp };
