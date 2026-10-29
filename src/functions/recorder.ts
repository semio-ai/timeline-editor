import { fromTaggedValue, type ScalarValue, type StateChange } from "@semio/data";
import type { RecordedKey, RecordedPoint, RecordedTrack } from "../types/data/recorded-track";

/** The key under every device where its Arora runtime publishes its clock, in nanoseconds. */
const CLOCK_KEY = "arora/time";

interface Recording extends RecordedKey {
  /** `<device>/<key>`, the key's name in the store. */
  storeKey: string;
  points: RecordedPoint[];
  /** The value of the last point, while the key still holds it as far as the changes tell. */
  held?: ScalarValue;
  /** A value set before its device's clock was seen, recorded when the clock is. */
  pending?: ScalarValue;
}

/**
 * Records keys of devices from the changes of a store whose keys are
 * `<device>/<key>`: each key gets a point whenever a change sets it to a value
 * other than the one it holds, stamped with its device's `arora/time` as the
 * same change sets it, or as the last change before did.
 *
 * It reads changes only, so it records what its source delivers: from a
 * source that coalesces a frame's changes per key, one value per key and
 * frame, stamped with the clock the device showed at the end of that frame.
 * {@link capture} has the shape of a `DataStore` listener, so a store's
 * `subscribe` feeds it, the first call bringing each key's current value. A
 * value no animatable can hold (a structure, an array) and a key's removal
 * add no point, and the next value after either is a point even when it
 * equals the last one. A value set before its device's clock was seen is
 * recorded when the clock is, at that time, unless a later change replaced
 * it. Nothing is kept beyond the recorder.
 */
export class Recorder {
  /** The keys the recorder reads: each recorded key, and its device's `arora/time`. */
  readonly storeKeys: readonly string[];
  private readonly recordings: Recording[];
  private readonly devices: readonly string[];
  /** Each device's clock, in milliseconds, as last seen. */
  private readonly clocks = new Map<string, number>();

  constructor(keys: readonly RecordedKey[]) {
    this.recordings = keys.map(({ device, key }) => ({
      device,
      key,
      storeKey: `${device}/${key}`,
      points: [],
    }));
    this.devices = [...new Set(keys.map(({ device }) => device))];
    this.storeKeys = [
      ...new Set([
        ...this.recordings.map(({ storeKey }) => storeKey),
        ...this.devices.map((device) => `${device}/${CLOCK_KEY}`),
      ]),
    ];
  }

  /** Takes one change of the store. */
  readonly capture = (change: StateChange): void => {
    for (const device of this.devices) {
      const clockKey = `${device}/${CLOCK_KEY}`;
      if (change.unset.has(clockKey)) this.clocks.delete(device);
      if (!change.set.has(clockKey)) continue;
      const timeNs = fromTaggedValue(change.set.get(clockKey));
      if (typeof timeNs === "number") this.clocks.set(device, timeNs / 1e6);
      else this.clocks.delete(device);
    }
    for (const recording of this.recordings) {
      if (change.unset.has(recording.storeKey)) {
        recording.held = undefined;
        recording.pending = undefined;
      }
      const stamp = this.clocks.get(recording.device);
      let value = recording.pending;
      if (change.set.has(recording.storeKey)) {
        value = fromTaggedValue(change.set.get(recording.storeKey));
        if (value === undefined) recording.held = undefined;
      }
      if (value === undefined) {
        recording.pending = undefined;
        continue;
      }
      if (stamp === undefined) {
        recording.pending = value;
        recording.held = undefined;
        continue;
      }
      recording.pending = undefined;
      if (Object.is(recording.held, value)) continue;
      recording.held = value;
      recording.points.push({ stamp, value });
    }
  };

  /** The tracks recorded so far, one per key, in the order the keys were given. */
  tracks(): RecordedTrack[] {
    return this.recordings.map(({ device, key, points }) => ({ device, key, points: [...points] }));
  }
}
