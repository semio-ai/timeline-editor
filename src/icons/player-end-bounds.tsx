import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react";
import type { GlyphProps as IconProps } from "@semio/ui";

const PlayerEndBounds: ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>> =
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
          d="M15.58,10.011C17.174,10.878 17.174,13.122 15.58,13.989L5.954,19.224C4.404,20.067 2.5,18.97 2.5,17.235L2.5,6.765C2.5,5.03 4.404,3.934 5.954,4.776L15.58,10.011Z"
          fill="currentColor"
          // fillRule="nonzero"
          // stroke="currentColor"
          fillOpacity={0.7}
          // strokeWidth={1.5}
          // strokeLinecap="round"
          // strokeMiterlimit={1.5}
        />
        <path
          d="M21.5,3.645L21.5,8.136L20.06,8.136C19.541,8.136 19.119,7.714 19.119,7.195L19.119,3.658C19.119,3.127 19.55,2.696 20.08,2.696L20.552,2.696C21.075,2.696 21.5,3.121 21.5,3.645Z"
          fill="currentColor"
          fillRule="nonzero"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeMiterlimit={1.5}
        />
        <path
          d="M21.5,20.349L21.5,15.864L20.075,15.864C19.548,15.864 19.119,16.292 19.119,16.82L19.119,20.356C19.119,20.879 19.544,21.304 20.067,21.304L20.545,21.304C21.072,21.304 21.5,20.876 21.5,20.349Z"
          fill="currentColor"
          fillRule="nonzero"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeMiterlimit={1.5}
        />
        <path
          d="M21.5,7.687L21.5,17.211"
          fill="none"
          fillRule="nonzero"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeMiterlimit={1.5}
        />
      </svg>
    );
  });

PlayerEndBounds.displayName = "PlayerEndBounds";

export { PlayerEndBounds };
