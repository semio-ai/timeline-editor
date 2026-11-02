import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react";
import type { GlyphProps as IconProps } from "@semio/ui";

const MovePlayhead: ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>> =
  forwardRef<SVGSVGElement, IconProps>((props, ref) => {
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
          d="M14.191,20.356L14.191,16.812C14.191,16.289 13.766,15.864 13.243,15.864L10.757,15.864C10.234,15.864 9.809,16.289 9.809,16.812L9.809,20.356C9.809,20.879 10.234,21.304 10.757,21.304L13.243,21.304C13.766,21.304 14.191,20.879 14.191,20.356Z"
          fill="currentColor"
          fillRule="nonzero"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeMiterlimit={1.5}
        />
        <path
          d="M14.191,3.658L14.191,7.175C14.191,7.705 13.76,8.136 13.229,8.136L10.771,8.136C10.24,8.136 9.809,7.705 9.809,7.175L9.809,3.658C9.809,3.127 10.24,2.696 10.771,2.696L13.229,2.696C13.76,2.696 14.191,3.127 14.191,3.658Z"
          fill="currentColor"
          fillRule="nonzero"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeMiterlimit={1.5}
        />
        <path
          d="M12,7.602L12,17.126"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeMiterlimit={1.5}
        />
      </svg>
    );
  });

MovePlayhead.displayName = "MovePlayhead";

export { MovePlayhead };
