import { describe, expect, it } from "vitest";
import type { AroraValue, StateChange } from "@semio/utils";
import { Recorder } from "../functions/recorder";

/** A change setting `set` (a `null` value unsets the key). */
function change(entries: Record<string, AroraValue | null>): StateChange {
  const set = new Map<string, AroraValue>();
  const unset = new Set<string>();
  for (const [key, value] of Object.entries(entries)) {
    if (value === null) unset.add(key);
    else set.set(key, value);
  }
  return { set, unset };
}

const ms = (milliseconds: number) => ({ u64: milliseconds * 1e6 });

describe("Recorder", () => {
  it("reads each recorded key and the clock of each device, once", () => {
    const recorder = new Recorder([
      { device: "sim", key: "joint1.target_position" },
      { device: "sim", key: "joint1.position" },
      { device: "robot", key: "joint1.position" },
    ]);

    expect(recorder.storeKeys).toEqual([
      "sim/joint1.target_position",
      "sim/joint1.position",
      "robot/joint1.position",
      "sim/arora/time",
      "robot/arora/time",
    ]);
  });

  it("stamps each change with its device's clock, in the same change or the last before", () => {
    const recorder = new Recorder([
      { device: "sim", key: "joint1.position" },
      { device: "robot", key: "joint1.position" },
    ]);

    recorder.capture(
      change({
        "sim/arora/time": ms(16),
        "sim/joint1.position": { f64: 0.5 },
        "robot/arora/time": ms(1000),
      }),
    );
    recorder.capture(change({ "robot/joint1.position": { f32: 0.25 } }));
    recorder.capture(change({ "sim/arora/time": ms(32), "sim/joint1.position": { f64: 0.75 } }));

    expect(recorder.tracks()).toEqual([
      {
        device: "sim",
        key: "joint1.position",
        points: [
          { stamp: 16, value: 0.5 },
          { stamp: 32, value: 0.75 },
        ],
      },
      { device: "robot", key: "joint1.position", points: [{ stamp: 1000, value: 0.25 }] },
    ]);
  });

  it("records strings and booleans, and keys of other devices not at all", () => {
    const recorder = new Recorder([
      { device: "sim", key: "label.value" },
      { device: "sim", key: "lamp.value" },
    ]);

    recorder.capture(
      change({
        "sim/arora/time": ms(0),
        "sim/label.value": { str: "on" },
        "sim/lamp.value": { bool: true },
        "other/label.value": { str: "off" },
      }),
    );

    expect(recorder.tracks().map(({ points }) => points)).toEqual([
      [{ stamp: 0, value: "on" }],
      [{ stamp: 0, value: true }],
    ]);
  });

  it("adds a point only when the value changes", () => {
    const recorder = new Recorder([{ device: "sim", key: "joint1.position" }]);

    recorder.capture(change({ "sim/arora/time": ms(0), "sim/joint1.position": { f64: 1 } }));
    recorder.capture(change({ "sim/arora/time": ms(16), "sim/joint1.position": { f64: 1 } }));
    recorder.capture(change({ "sim/arora/time": ms(32), "sim/joint1.position": { f64: 2 } }));

    expect(recorder.tracks()[0].points).toEqual([
      { stamp: 0, value: 1 },
      { stamp: 32, value: 2 },
    ]);
  });

  it("records the value that follows a removal or a value no animatable holds, even an equal one", () => {
    const recorder = new Recorder([{ device: "sim", key: "joint1.position" }]);

    recorder.capture(change({ "sim/arora/time": ms(0), "sim/joint1.position": { f64: 1 } }));
    recorder.capture(change({ "sim/arora/time": ms(16), "sim/joint1.position": null }));
    recorder.capture(change({ "sim/arora/time": ms(32), "sim/joint1.position": { f64: 1 } }));
    recorder.capture(change({ "sim/arora/time": ms(48), "sim/joint1.position": { f64s: [1] } }));
    recorder.capture(change({ "sim/arora/time": ms(64), "sim/joint1.position": { f64: 1 } }));

    expect(recorder.tracks()[0].points).toEqual([
      { stamp: 0, value: 1 },
      { stamp: 32, value: 1 },
      { stamp: 64, value: 1 },
    ]);
  });

  it("records a value set before its device's clock when the clock arrives, unless replaced or removed", () => {
    const recorder = new Recorder([
      { device: "robot", key: "battery" },
      { device: "robot", key: "joint1.position" },
      { device: "robot", key: "lamp.value" },
    ]);

    recorder.capture(
      change({
        "robot/battery": { f64: 0.9 },
        "robot/joint1.position": { f64: 1 },
        "robot/lamp.value": { bool: true },
      }),
    );
    recorder.capture(change({ "robot/joint1.position": { f64: 2 }, "robot/lamp.value": null }));
    recorder.capture(change({ "robot/arora/time": ms(16) }));

    expect(recorder.tracks().map(({ points }) => points)).toEqual([
      [{ stamp: 16, value: 0.9 }],
      [{ stamp: 16, value: 2 }],
      [],
    ]);
  });

  it("holds back a key's values while its device's clock is removed or holds no number", () => {
    const recorder = new Recorder([{ device: "sim", key: "joint1.position" }]);

    recorder.capture(change({ "sim/arora/time": ms(16), "sim/joint1.position": { f64: 2 } }));
    recorder.capture(change({ "sim/arora/time": null, "sim/joint1.position": { f64: 3 } }));
    recorder.capture(change({ "sim/arora/time": ms(48), "sim/joint1.position": { f64: 3 } }));
    recorder.capture(
      change({ "sim/arora/time": { str: "late" }, "sim/joint1.position": { f64: 4 } }),
    );
    recorder.capture(change({ "sim/arora/time": ms(80) }));

    expect(recorder.tracks()[0].points).toEqual([
      { stamp: 16, value: 2 },
      { stamp: 48, value: 3 },
      { stamp: 80, value: 4 },
    ]);
  });

  it("hands out tracks that later captures leave as they were", () => {
    const recorder = new Recorder([{ device: "sim", key: "joint1.position" }]);
    recorder.capture(change({ "sim/arora/time": ms(0), "sim/joint1.position": { f64: 1 } }));
    const [before] = recorder.tracks();

    recorder.capture(change({ "sim/arora/time": ms(16), "sim/joint1.position": { f64: 2 } }));

    expect(before.points).toHaveLength(1);
    expect(recorder.tracks()[0].points).toHaveLength(2);
  });
});
