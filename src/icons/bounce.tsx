import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react";
import type { GlyphProps as IconProps } from "@semio/ui";

const Bounce: ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>> =
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
          d="M18.875,2.5C17.161,2.5 15.75,3.929 15.75,5.667C15.75,7.404 17.161,8.833 18.875,8.833C20.589,8.833 22,7.404 22,5.667C22,3.929 20.589,2.5 18.875,2.5"
          fill="none"
          fillRule="nonzero"
          stroke="currentColor"
          strokeWidth="1.5px"
        />
        <path
          d="M2,16.433C6.234,14.106 8.404,16.523 11,21.5C11.785,17.425 12.718,13.68 15.75,9.833"
          fill="none"
          fillRule="nonzero"
          stroke="currentColor"
          strokeWidth="1.5px"
          strokeOpacity="0.6"
        />
      </svg>
    );
  });

Bounce.displayName = "Bounce";

export { Bounce };
