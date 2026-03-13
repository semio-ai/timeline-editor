/** Semantic labels for preview markers and timeline annotations. */
export enum SemanticTime {
  /** Current playhead position. */
  Current = "current",
  /** End of animation duration. */
  Duration = "duration",
  /** Next keyframe forward from playhead. */
  Forward = "forward",
  /** Previous keyframe before playhead. */
  Backward = "backward",
  /** Lower bound marker. */
  BoundsStart = "bounds-start",
  /** Upper bound marker. */
  BoundsEnd = "bounds-end",
  /** Hovered position. */
  Hover = "hover",
}
