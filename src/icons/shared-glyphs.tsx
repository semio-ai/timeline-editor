import { createGlyph } from "./_internal/create-glyph";

export const IconDataVector2 = createGlyph(
  "IconDataVector2",
  <>
    <path d="M3 3V21H21" opacity="0.6" />
    <g fill="currentColor" stroke="none">
      <circle cx="8" cy="15" r="1.5" />
      <circle cx="12" cy="8" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </g>
  </>,
);

export const IconDataVector3 = createGlyph(
  "IconDataVector3",
  <>
    <path d="M12 2V13M12 13L3 19M12 13L21 19" opacity="0.6" />
    <g fill="currentColor" stroke="none">
      <circle cx="6" cy="10" r="1.5" />
      <circle cx="16" cy="7" r="1.5" />
      <circle cx="14" cy="19" r="1.5" />
    </g>
  </>,
);

export const IconBezier = createGlyph(
  "IconBezier",
  <>
    <path d="M3 4a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2" />
    <path d="M17 18a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2" />
    <path d="M7 5l7 0" />
    <path d="M10 19l7 0" />
    <path d="M8 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M14 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M7 5.5a5 6.5 0 0 1 5 6.5a5 6.5 0 0 0 5 6.5" />
  </>,
);
