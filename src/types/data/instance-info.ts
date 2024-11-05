/**
 * A configuration object that specifies the rendering and behavior of a given instance of an animation
 * @param timescale - A multiplier for the playback speed of the animation. This is applied before offset. Larger values will speed up the animation, while smaller values will slow it down.
 * @param offset - The temporal offset of the animation in milliseconds. This is applied second, after timescale.
 */

export interface InstanceInfo {
  timescale: number;
  offset: number;
}
