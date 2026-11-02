import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react";
import type { GlyphProps as IconProps } from "@semio/ui";

const Playback20x: ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>> = forwardRef<
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
      <g transform="matrix(0.867199,0,0,0.867199,8.003995,-1.940713)">
        <path
          d="M5.5,9.694C7.708,9.694 9.001,11.45 9.001,15.893C9.001,20.337 7.708,22.093 5.5,22.093C3.293,22.093 2,20.337 2,15.893C2,11.45 3.293,9.694 5.5,9.694Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.73px"
        />
      </g>
      <g transform="matrix(0.867199,0,0,0.867199,-1.968073,1.750606)">
        <path
          d="M4,8C4,5.667 8.478,4.127 10,7C11.531,9.889 8.935,12.1 8.292,12.808C4.039,17.502 4,17.74 4,17.74L9.643,17.769"
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

Playback20x.displayName = "Playback20x";

export { Playback20x };
