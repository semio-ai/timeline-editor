import { createElement, type CSSProperties } from "react";
import { MovePlayerEndBounds, PlayerEndBounds, type IconComponent } from "@semio/ui";

/**
 * Start-bound artwork carries its orientation without requiring a caller's CSS.
 *
 * The half-turn is composed with whatever the caller asks for rather than replacing
 * it. A CSS `transform` overrides the SVG `transform` attribute the end-bound glyphs
 * use for `mirrored`, so `mirrored` is folded into the same CSS list here — otherwise
 * a mirrored start bound would silently render unmirrored.
 */
function startBound(Component: typeof PlayerEndBounds): IconComponent {
  return function StartBoundGlyph({ style, mirrored, ...props }) {
    const callerStyle = style as CSSProperties | undefined;
    const transform = [
      callerStyle?.transform,
      mirrored ? "scale(-1, 1)" : undefined,
      "rotate(180deg)",
    ]
      .filter(Boolean)
      .join(" ");
    return createElement(Component, {
      ...props,
      style: { transformOrigin: "center", ...callerStyle, transform },
    });
  };
}

export const MovePlayerStartBounds = startBound(MovePlayerEndBounds);
export const PlaybackSeekStartBounds = startBound(PlayerEndBounds);
