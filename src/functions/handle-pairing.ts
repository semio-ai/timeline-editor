import type { RawVector2 } from "@semio/data";

export const toViewVector = (delta: RawVector2, scaleX: number, scaleY: number): RawVector2 => ({
  x: delta.x * scaleX,
  y: delta.y * scaleY,
});

export const getViewLength = (delta: RawVector2, scaleX: number, scaleY: number): number => {
  const view = toViewVector(delta, scaleX, scaleY);
  return Math.hypot(view.x, view.y);
};

export const computePairedHandleDelta = (params: {
  draggedDelta: RawVector2;
  baselineDelta?: RawVector2;
  viewScaleX: number;
  viewScaleY: number;
  useDraggedLength: boolean;
}): RawVector2 | undefined => {
  const { draggedDelta, baselineDelta, viewScaleX, viewScaleY, useDraggedLength } = params;
  if (!baselineDelta) {
    return undefined;
  }

  const draggedView = toViewVector(draggedDelta, viewScaleX, viewScaleY);
  const draggedViewLen = Math.hypot(draggedView.x, draggedView.y);
  if (draggedViewLen <= 0) {
    return undefined;
  }

  const baselineLength = getViewLength(baselineDelta, viewScaleX, viewScaleY);
  const targetLength = useDraggedLength ? draggedViewLen : baselineLength;
  const unitX = draggedView.x / draggedViewLen;
  const unitY = draggedView.y / draggedViewLen;
  const pairedView = {
    x: -unitX * targetLength,
    y: -unitY * targetLength,
  };

  return {
    x: pairedView.x / viewScaleX,
    y: pairedView.y / viewScaleY,
  };
};
