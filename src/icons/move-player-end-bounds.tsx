import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react";
import type { GlyphProps as IconProps } from "@semio/ui";

const MovePlayerEndBounds: ForwardRefExoticComponent<
  IconProps & RefAttributes<SVGSVGElement>
> = forwardRef<SVGSVGElement, IconProps>((props, ref) => {
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
      <path
        d="M6.25,7.602L2.75,12L6.25,16.398"
        fill="none"
        fillRule="nonzero"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        strokeLinecap="round"
        strokeMiterlimit={1.5}
      />
      <path
        d="M17.75,7.602L21.25,12L17.75,16.398"
        fill="none"
        fillRule="nonzero"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        strokeLinecap="round"
        strokeMiterlimit={1.5}
      />
      <path
        d="M13.191,3.645L13.191,8.136L11.751,8.136C11.231,8.136 10.809,7.714 10.809,7.195L10.809,3.658C10.809,3.127 11.24,2.696 11.771,2.696L12.242,2.696C12.766,2.696 13.191,3.121 13.191,3.645Z"
        fill="currentColor"
        fillRule="nonzero"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeMiterlimit={1.5}
      />
      <path
        d="M13.191,20.349L13.191,15.864L11.766,15.864C11.238,15.864 10.809,16.292 10.809,16.82L10.809,20.356C10.809,20.879 11.234,21.304 11.757,21.304L12.236,21.304C12.763,21.304 13.191,20.876 13.191,20.349Z"
        fill="currentColor"
        fillRule="nonzero"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeMiterlimit={1.5}
      />
      <path
        d="M13.191,7.687L13.191,17.211"
        fill="currentColor"
        fillRule="nonzero"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeMiterlimit={1.5}
      />
    </svg>
  );
});

MovePlayerEndBounds.displayName = "MovePlayerEndBounds";

export { MovePlayerEndBounds };
