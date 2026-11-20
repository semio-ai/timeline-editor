import { describe, expect, it } from "vitest";
import { createCorpusStore } from "./parity/edit-corpus";

// The suite-wide setup deep-freezes every published snapshot, so the package's
// tests catch any code that edits one in place. This checks the setup is in
// effect for an ordinary test file.
describe("snapshots under test", () => {
  it("throw on an edit anywhere inside", () => {
    const store = createCorpusStore();
    const snapshot = store.getState().derivedSnapshot!;
    const row = Object.values(snapshot.rows).find((r) => r.computed.virtualFrames.length > 0)!;
    const frames = row.computed.virtualFrames;
    expect(() => frames.push(frames[0])).toThrow(TypeError);
    expect(() => {
      (frames[0] as { stamp: number }).stamp = -1;
    }).toThrow(TypeError);
    const samples = snapshot.renderSampleCache!.samples as Record<string, unknown>;
    expect(() => {
      samples.planted = {};
    }).toThrow(TypeError);
  });
});
