import type {
  DerivedRowSnapshot,
  DerivedSnapshot,
  PolylineSample,
  RenderSampleId,
  TrackRender,
} from "../types";

/**
 * A row as one build left it, with what it was built from, so the next build
 * can hand it on unchanged instead of computing it again.
 *
 * `row` is the row before vertical axes are projected onto it: projection
 * depends on the views, not on the row's inputs, and runs on every build.
 */
export interface ReusableRow {
  /** Everything the row read, compared one by one with `Object.is`. */
  inputs: readonly unknown[];
  row: DerivedRowSnapshot;
  /** The row's entries in the build's render sample cache. */
  samples: [RenderSampleId, PolylineSample][];
  trackIndex: [string, Partial<Record<TrackRender, RenderSampleId>>][];
}

export type ReusableRows = ReadonlyMap<string, ReusableRow>;

const reusableRowsBySnapshot = new WeakMap<DerivedSnapshot, ReusableRows>();

/** The rows a published snapshot was built with, for the next build to reuse. */
export function reusableRowsOf(snapshot: DerivedSnapshot | undefined): ReusableRows | undefined {
  return snapshot ? reusableRowsBySnapshot.get(snapshot) : undefined;
}

export function recordReusableRows(snapshot: DerivedSnapshot, rows: ReusableRows): void {
  reusableRowsBySnapshot.set(snapshot, rows);
}

export function sameInputs(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}
