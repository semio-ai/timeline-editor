import { memo, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { Theme } from "@semio/ui";
import { MotionValue } from "motion";
import { pick } from "lodash";
import { useAnimationStore, useColors } from "../../../hooks";
import { AnimationInstanceSettings } from "../../../types";
import { AnimationData } from "../../../store-types";
import { computeViolationSet } from "../../../functions";
import { FrustumBackground } from "./frustum-background";
import { ViolationRenderer } from "./violation-renderer";

export interface SharedSplineBackgroundProps {
  animationId: string; // Unique ID for the animation
  namespaceId: string; // Namespace for the animation, used for scoping
  instanceSettings?: AnimationInstanceSettings; // Settings for the animation instance
  trackIds?: string[];
  height?: number;
  yOffset?: number;
  zOffset?: number;
  theme?: Theme.Light | Theme.Dark;
  scrollOffset?: MotionValue<number>;
}

export const SharedSplineBackground = memo(function SharedSplineBackground({
  trackIds = [],
  height = 36,
  yOffset = 0,
  zOffset = 0,
  theme = Theme.Light,
  scrollOffset = new MotionValue(0),
}: SharedSplineBackgroundProps) {
  const color = useColors(trackIds);

  const violations = useAnimationStore(useShallow((state: AnimationData) => state.violations));

  const violationSet = useMemo(() => {
    const filteredViolations = pick(violations, trackIds);
    return computeViolationSet(filteredViolations);
  }, [violations, trackIds]);

  return (
    <group position={[0, yOffset, zOffset]}>
      {/* Render violations */}
      <ViolationRenderer
        violationSet={violationSet}
        theme={theme}
        height={height - 1}
        yOffset={scrollOffset}
        trackY
      />

      {/* Render a background for the Active region, and the General Background */}
      {trackIds.length > 0 && (
        <FrustumBackground
          color={color}
          height={height - 1}
          position={[0.5, 0, -1]}
          emphasis={false}
        />
      )}
    </group>
  );
});
