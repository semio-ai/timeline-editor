/** Rendering modes for tracks/rows. */
export enum TrackRender {
  /** Lightweight preview render (reduced fidelity). */
  Preview = "preview",
  /** Keyframe-only render. */
  Key = "key",
  /** Transition segment render. */
  Transition = "transition",
  /** Raw data render (value bars). */
  Data = "data",
  /** Spline (curve) render. */
  Spline = "spline",
}
