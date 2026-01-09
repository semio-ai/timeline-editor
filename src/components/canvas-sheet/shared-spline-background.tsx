import { memo, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { Theme } from "@semio/ui";
import { MotionValue } from "motion";
import { uniq } from "lodash";
import { useAnimationStore, useColors, useLocalGlobalTransformLookup } from "../../hooks";
import { Z } from "../../constants";
import { AnimationData } from "../../store-types";
import { FrustumBackground } from "./frustum-background";
import { ViolationRenderer } from "./violation-renderer";

export interface SharedSplineBackgroundProps {
  sourceRowId: string; // Settings for the animation instance
  height?: number;
  yOffset?: number;
  baseZ?: number;
  theme?: Theme.Light | Theme.Dark;
  scrollOffset?: MotionValue<number>;
}

export const SharedSplineBackground = memo(function SharedSplineBackground({
  sourceRowId,
  height = 36,
  yOffset = 0,
  baseZ = 0,
  theme = Theme.Light,
  scrollOffset = new MotionValue(0),
}: SharedSplineBackgroundProps) {
  const sourceRow = useAnimationStore(
    useShallow((state: AnimationData) => state.instancedTrackSources[sourceRowId]),
  );
  const computedData = useAnimationStore(
    useShallow((state: AnimationData) => state.derivedSnapshot?.rows?.[sourceRowId]?.computed),
  );
  const trackIds = uniq(sourceRow?.data.map((d) => d.trackId) || []);
  const localGlobalTransformLookup = useLocalGlobalTransformLookup();
  const rowInstanceId = useMemo(() => {
    if (!sourceRow) return undefined;
    const ids = uniq(
      sourceRow.data
        .map((entry) => entry.instanceId)
        .filter((value): value is string => Boolean(value)),
    );
    return ids.length === 1 ? ids[0] : undefined;
  }, [sourceRow]);
  const xTransform = useMemo(() => {
    const transform =
      rowInstanceId && localGlobalTransformLookup.toWorld[rowInstanceId]
        ? localGlobalTransformLookup.toWorld[rowInstanceId]
        : undefined;
    if (typeof transform === "function") {
      return transform;
    }
    return (stamp: number) => stamp;
  }, [localGlobalTransformLookup, rowInstanceId]);

  const color = useColors(trackIds);

  if (!sourceRow || !computedData) return null;

  return (
    <group position={[0, yOffset, baseZ]}>
      {/* Render violations */}
      <ViolationRenderer
        violationSet={computedData.violationSet}
        theme={theme}
        height={height - 1}
        yOffset={scrollOffset}
        trackY
        xTransform={xTransform}
      />

      {/* Render a background for the Active region, and the General Background */}
      {trackIds.length > 0 && (
        <FrustumBackground color={color} height={height - 1} z={Z.Background} emphasis={false} />
      )}
    </group>
  );
});
