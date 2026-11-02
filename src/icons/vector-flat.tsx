import { forwardRef, type ForwardedRef } from "react";
import { clsx } from "clsx";
import type { GlyphProps as IconProps } from "@semio/ui";

export interface IconVectorFlatProps extends IconProps {
  className?: string;
}

const IconVectorFlat = forwardRef(
  (
    { className, size, color, alt, mirrored, style, ...props }: IconVectorFlatProps,
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
        <g id="Curve-Flat">
          <path
            id="Hex2"
            className="transition-[fill]"
            fill={color ?? "currentColor"}
            d="M26.335,12.267c0.41,0 3.096,1.518 3.301,1.866c0.205,0.348 0.205,3.385 0,3.733c-0.205,0.348 -2.89,1.866 -3.301,1.866c-0.41,0 -3.096,-1.518 -3.301,-1.866c-0.205,-0.348 -0.205,-3.385 0,-3.733c0.205,-0.348 2.89,-1.866 3.301,-1.866Z"
          />
          <path
            id="Hex1"
            className="transition-[fill]"
            fill={color ?? "currentColor"}
            d="M5.665,12.267c0.41,0 3.096,1.518 3.301,1.866c0.205,0.348 0.205,3.385 0,3.733c-0.205,0.348 -2.89,1.866 -3.301,1.866c-0.41,0 -3.096,-1.518 -3.301,-1.866c-0.205,-0.348 -0.205,-3.385 0,-3.733c0.205,-0.348 2.89,-1.866 3.301,-1.866Z"
          />
          <path
            className="transition-[stroke]"
            d="M23.388,16l-14.718,0"
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

IconVectorFlat.displayName = "IconVectorFlat";

export { IconVectorFlat };
