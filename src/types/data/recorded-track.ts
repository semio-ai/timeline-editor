import type { ScalarValue } from "@semio/data";

/** A key of one device, as a recording names it. */
export interface RecordedKey {
  /** The device's id: its namespace in the store. */
  device: string;
  /** The key under the device's namespace (`joint1.position`). */
  key: string;
}

/** A value a recorded key took, at the time its device's clock showed. */
export interface RecordedPoint {
  /** The device's `arora/time` when the value was captured, in milliseconds. */
  stamp: number;
  value: ScalarValue;
}

/**
 * The values one key of one device took over the device's own clock, read-only.
 * It is keyed by device and key, so one view can hold, for one device, what
 * reached it (`<key>.target_position`) and what it did (`<key>.position`), and
 * the same keys of another device bound to the same entity beside them: a
 * simulation and a robot given one animation. A key nothing drives, a battery
 * level, records the same way.
 */
export interface RecordedTrack extends RecordedKey {
  /** A point at each change of the key's value, in the order captured. */
  points: readonly RecordedPoint[];
}
