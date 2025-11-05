import { AnimationData } from "../store-types";
import { ComputedRowData } from "../types";

export function resolveComputedRowData(
  state: AnimationData,
  rowId: string,
): ComputedRowData | undefined {
  if (state.derivedMode === "snapshot") {
    return state.derivedSnapshot?.rows[rowId]?.computed ?? state.computedRowData[rowId];
  }
  return state.computedRowData[rowId];
}
