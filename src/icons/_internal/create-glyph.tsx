import { forwardRef, type ReactNode } from "react";
import type { GlyphProps as IconProps } from "@semio/ui";

/** Shared 24-unit canvas for Semio's Solar-style glyphs. */
export function createGlyph(name: string, artwork: ReactNode) {
  const Glyph = forwardRef<SVGSVGElement, IconProps>(
    ({ size = "18px", color = "currentColor", alt, mirrored = false, ...props }, ref) => (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        color={color}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={mirrored ? "scale(-1, 1)" : undefined}
        {...props}
      >
        {alt ? <title>{alt}</title> : null}
        {artwork}
      </svg>
    ),
  );
  Glyph.displayName = name;
  return Glyph;
}
