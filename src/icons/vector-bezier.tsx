import { forwardRef, type ForwardedRef } from "react";
import { clsx } from "clsx";
import type { GlyphProps as IconProps } from "@semio/ui";

export interface IconVectorBezierProps extends IconProps {
  className?: string;
}

const IconVectorBezier = forwardRef(
  (
    { className, size, color, alt, mirrored, style, ...props }: IconVectorBezierProps,
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
            id="Hex2"
            className="transition-[fill]"
            fill={color ?? "currentColor"}
            d="M26.335,1.932c0.41,0 3.096,1.518 3.301,1.866c0.205,0.348 0.205,3.385 0,3.733c-0.205,0.348 -2.89,1.866 -3.301,1.866c-0.41,0 -3.096,-1.518 -3.301,-1.866c-0.205,-0.348 -0.205,-3.385 0,-3.733c0.205,-0.348 2.89,-1.866 3.301,-1.866Z"
          />
          <path
            id="Hex1"
            className="transition-[fill]"
            fill={color ?? "currentColor"}
            d="M5.665,22.602c0.41,0 3.096,1.518 3.301,1.866c0.205,0.348 0.205,3.385 0,3.733c-0.205,0.348 -2.89,1.866 -3.301,1.866c-0.41,0 -3.096,-1.518 -3.301,-1.866c-0.205,-0.348 -0.205,-3.385 0,-3.733c0.205,-0.348 2.89,-1.866 3.301,-1.866Z"
          />
          <path
            className="transition-[stroke]"
            d="M23.388,5.665c-4.037,-0 -7.359,4.665 -7.359,10.335c0,5.67 -3.322,10.335 -7.359,10.335"
            style={{
              fill: "none",
              fillRule: "nonzero",
              stroke: color ?? "currentColor",
              strokeWidth: 2,
            }}
          />
        </g>
        <g id="Handles" opacity="0">
          <path
            className="transition-[stroke]"
            d="M23.388,5.91l-10.303,0"
            style={{
              fill: "none",
              fillRule: "nonzero",
              stroke: color ?? "currentColor",
              strokeWidth: 2,
            }}
          />
          <path
            className="transition-[stroke]"
            d="M18.973,26.09l-10.303,0"
            style={{
              fill: "none",
              fillRule: "nonzero",
              stroke: color ?? "currentColor",
              strokeWidth: 2,
            }}
          />
          <circle
            cx="11.141"
            cy="5.91"
            r="2.5"
            className="transition-[fill]"
            fill={color ?? "currentColor"}
          />
          <circle
            cx="20.859"
            cy="26.09"
            r="2.5"
            className="transition-[fill]"
            fill={color ?? "currentColor"}
          />
        </g>
      </svg>
    );
  },
);

IconVectorBezier.displayName = "IconVectorBezier";

export { IconVectorBezier };
