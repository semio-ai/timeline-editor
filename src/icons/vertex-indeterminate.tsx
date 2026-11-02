import { forwardRef, type ForwardedRef } from "react";
import { clsx } from "clsx";
import type { GlyphProps as IconProps } from "@semio/ui";

export interface IconVertexIndeterminateProps extends IconProps {
  className?: string;
}

const IconVertexIndeterminate = forwardRef(
  (
    { className, size, color, alt, mirrored, style, ...props }: IconVertexIndeterminateProps,
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
            d="M5.648,16l20.998,0"
            className="transition-[stroke]"
            fill="none"
            fillRule="nonzero"
            stroke={color ?? "currentColor"}
            strokeWidth={2}
          />
          <circle
            cx="26.645"
            cy="16"
            r="2.5"
            className="transition-[fill]"
            fill={color ?? "currentColor"}
          />
          <path
            d="M3.054,16.482l2.187,2.187c0.266,0.266 0.698,0.266 0.964,0l2.187,-2.187c0.266,-0.266 0.266,-0.698 0,-0.964l-2.187,-2.187c-0.266,-0.266 -0.698,-0.266 -0.964,0l-2.187,2.187c-0.266,0.266 -0.266,0.698 0,0.964Z"
            className="transition-[fill]"
            fill={color ?? "currentColor"}
          />
        </g>
        <path
          id="Hex"
          d="M16.146,12.267c0.41,0 3.096,1.518 3.301,1.866c0.205,0.348 0.205,3.385 0,3.733c-0.205,0.348 -2.89,1.866 -3.301,1.866c-0.41,0 -3.096,-1.518 -3.301,-1.866c-0.205,-0.348 -0.205,-3.385 0,-3.733c0.205,-0.348 2.89,-1.866 3.301,-1.866Z"
          className="transition-[fill]"
          fill={color ?? "currentColor"}
        />
      </svg>
    );
  },
);

IconVertexIndeterminate.displayName = "IconVertexIndeterminate";

export { IconVertexIndeterminate };
