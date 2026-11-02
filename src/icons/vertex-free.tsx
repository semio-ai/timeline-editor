import { forwardRef, type ForwardedRef } from "react";
import { clsx } from "clsx";
import type { GlyphProps as IconProps } from "@semio/ui";

export interface IconVertexFreeProps extends IconProps {
  className?: string;
}

const IconVertexFree = forwardRef(
  (
    { className, size, color, alt, mirrored, style, ...props }: IconVertexFreeProps,
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
            d="M5.501,6.043l10.499,6.082l10.499,-6.082"
            className="transition-[stroke]"
            fill="none"
            fillRule="nonzero"
            stroke={color ?? "currentColor"}
            strokeWidth={2}
          />
          <path
            d="M28.975,5.131l-0.801,2.988c-0.097,0.364 -0.472,0.58 -0.835,0.482l-2.988,-0.801c-0.364,-0.097 -0.58,-0.472 -0.482,-0.835l0.801,-2.988c0.097,-0.364 0.472,-0.58 0.835,-0.482l2.988,0.801c0.364,0.097 0.58,0.472 0.482,0.835Z"
            className="transition-[fill]"
            fill={color ?? "currentColor"}
          />
          <path
            d="M3.025,5.131l0.801,2.988c0.097,0.364 0.472,0.58 0.835,0.482l2.988,-0.801c0.364,-0.097 0.58,-0.472 0.482,-0.835l-0.801,-2.988c-0.097,-0.364 -0.472,-0.58 -0.835,-0.482l-2.988,0.801c-0.364,0.097 -0.58,0.472 -0.482,0.835Z"
            className="transition-[fill]"
            fill={color ?? "currentColor"}
          />
        </g>
        <path
          id="Hex"
          d="M16,8.392c0.41,0 3.096,1.518 3.301,1.866c0.205,0.348 0.205,3.385 0,3.733c-0.205,0.348 -2.89,1.866 -3.301,1.866c-0.41,0 -3.096,-1.518 -3.301,-1.866c-0.205,-0.348 -0.205,-3.385 0,-3.733c0.205,-0.348 2.89,-1.866 3.301,-1.866Z"
          className="transition-[fill]"
          fill={color ?? "currentColor"}
        />
        <path
          id="Curve"
          d="M5.501,27.194c1.264,-14.054 2.012,-21.047 10.499,-15.069c8.525,-6.065 8.762,0.925 10.499,15.069"
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

IconVertexFree.displayName = "IconVertexFree";

export { IconVertexFree };
