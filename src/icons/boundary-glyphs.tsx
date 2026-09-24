import { createElement, type CSSProperties } from "react";
import { MovePlayerEndBounds, PlayerEndBounds, type IconComponent } from "@semio/ui";

/** Start-bound artwork carries its orientation without requiring a caller's CSS. */
function startBound(Component: typeof PlayerEndBounds): IconComponent {
  return function StartBoundGlyph({ style, ...props }) {
    return createElement(Component, {
      ...props,
      style: {
        ...(style as CSSProperties | undefined),
        transform: "rotate(180deg)",
        transformOrigin: "center",
      },
    });
  };
}

export const MovePlayerStartBounds = startBound(MovePlayerEndBounds);
export const PlaybackSeekStartBounds = startBound(PlayerEndBounds);
