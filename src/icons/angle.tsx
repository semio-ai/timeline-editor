import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react";
import type { GlyphProps as IconProps } from "@semio/ui";

const Angle: ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>> = forwardRef<
  SVGSVGElement,
  IconProps
>((props, ref) => {
  const { alt, color = "currentColor", size = "18px", mirrored = false, ...restProps } = props;

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      color={color}
      fill="none"
      viewBox="0 0 24 24"
      transform={mirrored ? "scale(-1, 1)" : undefined}
      {...restProps}
    >
      {!!alt && <title>{alt}</title>}
      <g transform="matrix(1.111111,0,0,1.111111,-1.74302,-0.777778)">
        <path
          d="M21,19L4.7,19C4.353,19 4.033,18.813 3.862,18.512C3.692,18.21 3.696,17.84 3.875,17.542C6.136,13.774 12,4 12,4"
          fill="none"
          fillRule="nonzero"
          stroke="currentColor"
          strokeWidth="1.5px"
        />
      </g>
      <g transform="matrix(1.111111,0,0,1.111111,-1.74302,-0.777778)">
        <path
          d="M11.103,5.495C15.683,8.25 18.75,13.27 18.75,19"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.6"
          strokeWidth="1.5px"
        />
      </g>
    </svg>
  );
});

Angle.displayName = "Angle";

export { Angle };
