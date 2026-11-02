import { forwardRef, type ForwardedRef } from "react";
import type { GlyphProps as IconProps } from "@semio/ui";
import { clsx } from "clsx";

export interface IconHandleIndicatorProps extends Omit<IconProps, "stroke" | "ref"> {
  size?: string | number;
  stroke?: string | number;
  title?: string;
  className?: string;
  fillOpacity?: number;
  handle: "diamond" | "circle" | "indeterminate";
}

const IconHandleIndicator = forwardRef(
  (
    {
      size,
      color,
      stroke: _stroke,
      title,
      alt = title,
      mirrored,
      className,
      style,
      fillOpacity = 1,
      handle = "circle",
      ...props
    }: IconHandleIndicatorProps,
    ref: ForwardedRef<SVGSVGElement>,
  ) => {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size ?? 24}
        height={size ?? 24}
        className={clsx("icon icon-tabler", className)}
        viewBox="0 0 32 32"
        version="1.1"
        strokeLinecap="round"
        transform={mirrored ? "scale(-1, 1)" : undefined}
        {...props}
        style={{
          fillRule: "evenodd",
          clipRule: "evenodd",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          ...style,
        }}
      >
        {alt ? <title>{alt}</title> : null}
        <g id="Outline">
          {handle === "indeterminate" && (
            <g id="Indeterminate">
              <path
                d="M9.012,22.313l13.976,-13.173"
                className="transition-[stroke]"
                fill="none"
                fillRule="nonzero"
                stroke={color ?? "currentColor"}
                strokeWidth={3}
              />
              <path
                d="M22.988,22.313l-13.976,-13.173"
                className="transition-[stroke]"
                fill="none"
                fillRule="nonzero"
                stroke={color ?? "currentColor"}
                strokeWidth={3}
              />
              <path
                d="M2.667,15.726l13.333,0"
                className="transition-[stroke]"
                fill="none"
                fillRule="nonzero"
                stroke={color ?? "currentColor"}
                strokeWidth={3}
              />
            </g>
          )}
          <path
            d="M2.667,15.726l4.481,0"
            className="transition-[stroke]"
            fill="none"
            fillRule="nonzero"
            stroke={color ?? "currentColor"}
            strokeWidth={3}
          />
          {handle === "circle" && (
            <circle
              id="Circle-Outline"
              cx="16"
              cy="16"
              r="7.853"
              className="transition-[stroke]"
              fill="none"
              fillRule="nonzero"
              stroke={color ?? "currentColor"}
              strokeWidth={3}
            />
          )}
          {handle === "diamond" && (
            <path
              id="Diamond-Outline"
              d="M8.167,17.141l6.418,6.418c0.781,0.781 2.049,0.781 2.83,0l6.418,-6.418c0.781,-0.781 0.781,-2.049 0,-2.83l-6.418,-6.418c-0.781,-0.781 -2.049,-0.781 -2.83,0l-6.418,6.418c-0.781,0.781 -0.781,2.049 0,2.83Z"
              className="transition-[stroke]"
              fill="none"
              fillRule="nonzero"
              stroke={color ?? "currentColor"}
              strokeWidth={3}
            />
          )}
        </g>
        <g id="Fill" opacity={fillOpacity}>
          {handle === "circle" && (
            <circle
              id="Circle-Fill"
              cx="16"
              cy="16"
              r="7.853"
              className="transition-[fill]"
              fill={color ?? "currentColor"}
            />
          )}
          {handle === "diamond" && (
            <path
              id="Diamond-Fill"
              d="M8.167,17.415l6.418,6.418c0.781,0.781 2.049,0.781 2.83,0l6.418,-6.418c0.781,-0.781 0.781,-2.049 0,-2.83l-6.418,-6.418c-0.781,-0.781 -2.049,-0.781 -2.83,0l-6.418,6.418c-0.781,0.781 -0.781,2.049 0,2.83Z"
              className="transition-[fill]"
              fill={color ?? "currentColor"}
            />
          )}
        </g>
      </svg>
    );
  },
);

IconHandleIndicator.displayName = "IconHandleIndicator";

export { IconHandleIndicator };
