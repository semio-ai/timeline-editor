import { forwardRef, type ForwardedRef } from "react";
import { clsx } from "clsx";
import type { GlyphProps as IconProps } from "@semio/ui";

export interface IconGraphViewProps extends IconProps {
  className?: string;
}

const IconGraphView = forwardRef(
  (
    { className, size, color, alt, mirrored, style, ...props }: IconGraphViewProps,
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
          d="M2.667,16c0,-6.285 0,-9.428 1.953,-11.381c1.953,-1.953 5.095,-1.953 11.381,-1.953c6.285,0 9.428,0 11.381,1.953c1.953,1.953 1.953,5.095 1.953,11.381c0,6.285 0,9.428 -1.953,11.381c-1.953,1.953 -5.095,1.953 -11.381,1.953c-6.285,0 -9.428,0 -11.381,-1.953c-1.953,-1.953 -1.953,-5.095 -1.953,-11.381Z"
          fill="none"
          fillRule="nonzero"
          stroke={color ?? "currentColor"}
          strokeWidth={2}
        />
        <g opacity="0.6">
          <path
            className="transition-[stroke]"
            d="M12,2.667l0,26.667"
            fill="none"
            fillRule="nonzero"
            stroke={color ?? "currentColor"}
            strokeWidth={2}
          />
          <path
            className="transition-[stroke]"
            d="M2.667,12.667l26.667,-0.333"
            fill="none"
            fillRule="nonzero"
            stroke={color ?? "currentColor"}
            strokeWidth={2}
          />
        </g>
      </svg>
    );
  },
);

IconGraphView.displayName = "IconGraphView";

export { IconGraphView };
