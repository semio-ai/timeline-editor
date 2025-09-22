import { memo, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { Theme } from "@semio/ui";
import { MotionValue } from "motion";
import { pick, uniq } from "lodash";
import { useAnimationStore, useColors } from "../../hooks";
import { Z } from "../../constants";
import { AnimationData } from "../../store-types";
import { computeViolationSet } from "../../functions";
import { FrustumBackground } from "./frustum-background";
import { ViolationRenderer } from "./violation-renderer";

export interface SharedSplineBackgroundProps {
  sourceRowId: string; // Settings for the animation instance
  height?: number;
  yOffset?: number;
  theme?: Theme.Light | Theme.Dark;
  scrollOffset?: MotionValue<number>;
}

export const SharedSplineBackground = memo(function SharedSplineBackground({
  sourceRowId,
  height = 36,
  yOffset = 0,
  theme = Theme.Light,
  scrollOffset = new MotionValue(0),
}: SharedSplineBackgroundProps) {
  const sourceRow = useAnimationStore(
    useShallow((state: AnimationData) => state.instancedTrackSources[sourceRowId]),
  );
  const computedData = useAnimationStore(
    useShallow((state: AnimationData) => state.computedRowData[sourceRowId]),
  );
  const trackIds = uniq(sourceRow.data.map((d) => d.trackId));

  const color = useColors(trackIds);

  return (
    <group position={[0, yOffset, 0]}>
      {/* Render violations */}
      <ViolationRenderer
        violationSet={computedData.violationSet}
        theme={theme}
        height={height - 1}
        yOffset={scrollOffset}
        trackY
      />

      {/* Render a background for the Active region, and the General Background */}
      {trackIds.length > 0 && (
        <FrustumBackground color={color} height={height - 1} z={Z.Background} emphasis={false} />
      )}
    </group>
  );
});
