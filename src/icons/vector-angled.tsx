import { forwardRef, type ForwardedRef } from "react";
import { clsx } from "clsx";
import type { GlyphProps as IconProps } from "@semio/ui";

export interface IconVectorAngledProps extends IconProps {
  className?: string;
}

const IconVectorAngled = forwardRef(
  (
    { className, size, color, alt, mirrored, style, ...props }: IconVectorAngledProps,
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
            d="M26.335,5.665c-3.037,3 -16.628,16.67 -20.665,20.67"
            style={{
              fill: "none",
              fillRule: "nonzero",
              stroke: color ?? "currentColor",
              strokeWidth: 2,
            }}
          />
        </g>
      </svg>
    );
  },
);

IconVectorAngled.displayName = "IconVectorAngled";

export { IconVectorAngled };
