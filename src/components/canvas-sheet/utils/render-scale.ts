import { createLinearScale } from "../../../functions";
import { TrackRender, VerticalAxisRange } from "../../../types";

export interface RenderScaleConfig {
  trackRender: TrackRender;
  height: number;
  verticalBounds: { min: number; max: number };
  verticalAxisRange?: VerticalAxisRange;
}

export interface RenderScaleResult {
  renderScaleY: (value: number) => number;
  isSpline: boolean;
  buffer: number;
  splineRange: { min: number; max: number; span: number };
}

export function computeRenderScale({
  trackRender,
  height,
  verticalBounds,
  verticalAxisRange,
}: RenderScaleConfig): RenderScaleResult {
  const buffer = height * 0.4;
  const isSpline = trackRender === TrackRender.Spline;
  const visualScaleFactor = verticalAxisRange?.visualScale ?? 1;
  const visualOffset = verticalAxisRange?.visualOffset ?? 0;

  const splineRange = isSpline
    ? (() => {
        const span = Math.max(height * visualScaleFactor, 1);
        const halfSpan = span / 2;
        return {
          min: -halfSpan + visualOffset,
          max: halfSpan + visualOffset,
          span,
        };
      })()
    : { min: 0, max: 0, span: 0 };

  const renderScaleY = (() => {
    if (isSpline) {
      const domainMin = verticalBounds.min;
      const domainMax = verticalBounds.max;
      const domainSpan = domainMax - domainMin;
      if (!Number.isFinite(domainSpan) || domainSpan === 0) {
        const center = (splineRange.min + splineRange.max) / 2;
        return () => center;
      }
      return createLinearScale([domainMin, domainMax], [splineRange.min, splineRange.max]);
    }
    if (trackRender === TrackRender.Preview) {
      const min = verticalBounds.min;
      const max = verticalBounds.max;
      if (max === min) {
        return () => 0;
      }
      return createLinearScale([min, max], [-buffer, buffer]);
    }
    return createLinearScale([0, 1], [-buffer, buffer]);
  })();

  return {
    renderScaleY,
    isSpline,
    buffer,
    splineRange,
  };
}
