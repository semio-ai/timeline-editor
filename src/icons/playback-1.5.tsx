import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react";
import type { GlyphProps as IconProps } from "@semio/ui";

const Playback15x: ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>> = forwardRef<
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
      fillRule="evenodd"
      clipRule="evenodd"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit={1.5}
      viewBox="0 0 24 24"
      transform={mirrored ? "scale(-1, 1)" : undefined}
      {...restProps}
    >
      {!!alt && <title>{alt}</title>}
      <g transform="matrix(0.75889,0,0,0.924517,-1.53556,4.564691)">
        <path d="M4,4L8,2L8,13.63" fill="none" stroke="currentColor" strokeWidth="1.77px" />
      </g>
      <g transform="matrix(0.867199,0,0,0.867199,4.565437,1.369067)">
        <path
          d="M12.534,5.877L6,5.877L5.965,10.786C7.455,10.803 12.966,9.762 12.966,14.276C12.966,18.79 7.103,19.415 6.225,15.97"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.73px"
        />
      </g>
      <g transform="matrix(0.589583,0,0,0.589583,9.618748,7.195395)">
        <g opacity="0.6">
          <path d="M21,10L14.392,17" fill="none" stroke="currentColor" strokeWidth="2.54px" />
          <g transform="matrix(-1,0,0,1,35.391873,0)">
            <path d="M21,10L14.392,17" fill="none" stroke="currentColor" strokeWidth="2.54px" />
          </g>
        </g>
      </g>
      <g transform="matrix(0.731813,0,0,0.731813,6.253534,4.806895)">
        <circle cx="2.592" cy="16.889" r="0.889" fill="currentColor" />
      </g>
    </svg>
  );
});

Playback15x.displayName = "Playback15x";

export { Playback15x };
