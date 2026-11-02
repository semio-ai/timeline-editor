import { forwardRef, type ForwardedRef } from "react";
import { clsx } from "clsx";
import type { GlyphProps as IconProps } from "@semio/ui";

export interface IconVertexPairedProps extends IconProps {
  className?: string;
}

const IconVertexPaired = forwardRef(
  (
    { className, size, color, alt, mirrored, style, ...props }: IconVertexPairedProps,
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
        <g id="Handles">
          <path
            d="M6.827,6.041l18.346,0"
            className="transition-[stroke]"
            fill="none"
            fillRule="nonzero"
            stroke={color ?? "currentColor"}
            strokeWidth={2}
          />
          <circle
            cx="26.499"
            cy="6.048"
            r="2.5"
            className="transition-[fill]"
            fill={color ?? "currentColor"}
          />
          <circle
            cx="5.501"
            cy="6.043"
            r="2.5"
            className="transition-[fill]"
            fill={color ?? "currentColor"}
          />
        </g>
        <path
          id="Hex"
          className="transition-[fill]"
          fill={color ?? "currentColor"}
          d="M16,2.315c0.41,0 3.096,1.518 3.301,1.866c0.205,0.348 0.205,3.385 0,3.733c-0.205,0.348 -2.89,1.866 -3.301,1.866c-0.41,0 -3.096,-1.518 -3.301,-1.866c-0.205,-0.348 -0.205,-3.385 0,-3.733c0.205,-0.348 2.89,-1.866 3.301,-1.866Z"
        />
        <path
          id="Curve"
          d="M5.501,27.194c1.264,-14.054 1.988,-21.149 10.499,-21.149c8.488,-0 8.762,7.005 10.499,21.149"
          className="transition-[stroke]"
          fill="none"
          fillRule="nonzero"
          stroke={color ?? "currentColor"}
          strokeWidth={2}
          strokeOpacity={0.6}
        />
      </svg>
    );
  },
);

IconVertexPaired.displayName = "IconVertexPaired";

export { IconVertexPaired };
