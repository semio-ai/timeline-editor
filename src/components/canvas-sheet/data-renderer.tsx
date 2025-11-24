import { Fragment, memo, useMemo, useCallback, useRef, useState, useEffect } from "react";
import { useShallow } from "zustand/shallow";
import { Theme } from "@semio/ui";
import { MotionValue } from "motion";
import { useMotionValueEvent, useSpring } from "motion/react";
import { Instances } from "@react-three/drei";
import { uniq } from "lodash";
import { useAnimationStore, useColors } from "../../hooks";
import {
  InstancedFrameInfo,
  LayerBand,
  SourceRow,
  TrackRender,
  VerticalAxisRange,
} from "../../types";
import { AnimationData, AnimationActions } from "../../store-types";
import { DEFAULT_COLOR, Z } from "../../constants";
import { DataPoint } from "./data-point";
import { FrustumBackground } from "./frustum-background";
import { ViolationRenderer } from "./violation-renderer";
import { TransitionSegment } from "./transition-segment";
import { BezierHandles } from "./bezier-handles";

const HANDLE_REVEAL_DELAY_MS = 120;

const DataPointsRenderer = memo(function DataPointsRenderer({
  sourceRow,
  frames,
  verticalBounds,
  verticalAxisRange,
  theme = Theme.Light,
  trackRender = TrackRender.Key,
  height = 36,
}: {
  sourceRow: SourceRow;
  frames: InstancedFrameInfo[];
  verticalBounds: { min: number; max: number };
  verticalAxisRange?: VerticalAxisRange;
  theme?: Theme.Light | Theme.Dark;
  trackRender?: TrackRender;
  height?: number;
}) {
  const visibleHexFrameCount = useMemo(
    () => frames.filter((f) => f.points.some((p) => p.layerBand !== LayerBand.Background)).length,
    [frames],
  );

  const instanceCount = visibleHexFrameCount * 2;

  // Unique key to force re-creation when sourceRow or instanceCount changes
  const instancesKey = `${sourceRow.id}:${instanceCount.toString()}`;

  // If the track render is spline, but the row is a group, ignore it
  if (trackRender === TrackRender.Spline && sourceRow.data.length > 1) {
    return null;
  }

  return (
    <Instances key={instancesKey} limit={Math.max(instanceCount, 1024)} range={instanceCount}>
      {/* Shared geometry and material for all instances */}
      <cylinderGeometry args={[5, 5, 1, 6]} />
      <meshBasicMaterial toneMapped={false} />

      {/* Individual instances */}
      {frames.map((frame) => (
        <DataPoint
          key={frame.id}
          markerId={frame.id}
          sourceRowId={sourceRow.id}
          theme={theme}
          trackRender={trackRender}
          height={height}
          verticalBounds={verticalBounds}
          verticalAxisRange={verticalAxisRange}
        />
      ))}
    </Instances>
  );
});

export interface DataRendererProps {
  sourceRowId: string;
  height?: number;
  emphasis?: boolean;
  onEmphasisChange?: (emphasis: boolean) => void;
  viewId?: string;
  yOffset?: number;
  baseZ?: number;
  theme?: Theme.Light | Theme.Dark;
  scrollOffset?: MotionValue<number>;
  measureFromBottom?: boolean;
  showBackground?: boolean;
  trackRender?: TrackRender;
}

// WARNING: This component passes frameData as props to child components
// After drag operations, these props can become stale while the store has updated
// This causes selection issues, particularly for the last marker in multi-selection drags
// This architectural issue will be resolved in Phase 2+ refactoring
// See: docs/dragging-architecture-proposal.md and docs/phase2-preparation.md
export const DataRenderer = memo(function DataRenderer({
  sourceRowId,
  height = 36,
  emphasis = false,
  onEmphasisChange = () => {},
  viewId,
  yOffset = 0,
  baseZ = 0,
  theme = Theme.Light,
  scrollOffset = new MotionValue(0),
  measureFromBottom = false,
  showBackground = true,
  trackRender = TrackRender.Key,
}: DataRendererProps) {
  type StoreState = AnimationData & AnimationActions;
  const sourceRow = useAnimationStore(
    useShallow((state: StoreState) => state.instancedTrackSources[sourceRowId]),
  );
  const computedData = useAnimationStore(
    useShallow((state: StoreState) => state.derivedSnapshot?.rows?.[sourceRowId]?.computed),
  );
  const selectionState = useAnimationStore(useShallow((state: StoreState) => state.selectionState));
  const focusSelectionInstance = useAnimationStore(
    useShallow((state: StoreState) => state.focusSelectionInstance),
  );

  const trackIds = useMemo(
    () => (sourceRow ? uniq(sourceRow.data.map((s) => s.trackId)) : []),
    [sourceRow],
  );
  const transitionLayer: LayerBand = useMemo(() => {
    const frames = computedData?.virtualFrames ?? [];
    const allLayers = uniq(frames.flatMap((vf) => vf.points).map((p) => p.layerBand));
    if (allLayers.length === 0) {
      return LayerBand.Background;
    }
    if (allLayers.length === 1) {
      return allLayers[0];
    } else if (allLayers.includes(LayerBand.ForegroundUnselected)) {
      return LayerBand.ForegroundUnselected;
    } else if (allLayers.includes(LayerBand.ForegroundSelected)) {
      return LayerBand.ForegroundSelected;
    } else {
      return LayerBand.Background;
    }
  }, [computedData?.virtualFrames]);
  const color = useColors(trackIds);
  const hoverCountRef = useRef(0);
  const [isRowHovered, setIsRowHovered] = useState(false);

  const handleSegmentHoverChange = useCallback((hovering: boolean) => {
    hoverCountRef.current = Math.max(0, hoverCountRef.current + (hovering ? 1 : -1));
    if (hoverCountRef.current < 0) {
      hoverCountRef.current = 0;
    }
    setIsRowHovered(hoverCountRef.current > 0);
  }, []);

  const uniqueInstanceId = useMemo(() => {
    if (!sourceRow) return undefined;
    const ids = uniq(sourceRow.data.map((data) => data.instanceId).filter(Boolean));
    return ids.length === 1 ? ids[0] : undefined;
  }, [sourceRow]);

  const shouldRenderTrackSwitchOverlay =
    Boolean(uniqueInstanceId) && selectionState.instanceId !== uniqueInstanceId;

  const handleTrackSwitch = useCallback(
    (event?: { stopPropagation?: () => void }) => {
      event?.stopPropagation?.();
      if (!uniqueInstanceId) return;
      focusSelectionInstance(uniqueInstanceId);
    },
    [focusSelectionInstance, uniqueInstanceId],
  );

  const keyForced: boolean = useMemo(() => {
    if (!sourceRow) return true;
    return !sourceRow.data.every((d) => d.type === "number");
  }, [sourceRow]);

  const rowHasSelection = useMemo(() => {
    if (!sourceRow || !selectionState?.instanceId) return false;
    const instanceMatchesRow = sourceRow.data.some(
      (entry) => entry.instanceId === selectionState.instanceId,
    );
    if (!instanceMatchesRow) return false;
    return sourceRow.data.some(
      (entry) => (selectionState.keypoints.get(entry.trackId)?.size ?? 0) > 0,
    );
  }, [selectionState, sourceRow]);

  const [handlesDelayReady, setHandlesDelayReady] = useState(false);
  const handlesAppearanceMV = useSpring(0, { stiffness: 700, damping: 40 });
  const [handlesAppearance, setHandlesAppearance] = useState(0);
  const previousTrackRender = useRef(trackRender);
  useMotionValueEvent(handlesAppearanceMV, "change", setHandlesAppearance);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (trackRender === TrackRender.Spline) {
      const delay = previousTrackRender.current === TrackRender.Spline ? 0 : HANDLE_REVEAL_DELAY_MS;
      setHandlesDelayReady(false);
      timeout = setTimeout(() => {
        setHandlesDelayReady(true);
      }, delay);
    } else {
      setHandlesDelayReady(false);
      handlesAppearanceMV.set(0);
    }
    previousTrackRender.current = trackRender;
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [handlesAppearanceMV, trackRender]);

  const canRenderHandles = trackRender === TrackRender.Spline && !keyForced;
  const rowHandlesEligible = canRenderHandles && rowHasSelection;

  useEffect(() => {
    const target = rowHandlesEligible && handlesDelayReady ? 1 : 0;
    handlesAppearanceMV.set(target);
  }, [handlesAppearanceMV, handlesDelayReady, rowHandlesEligible]);

  const axisRange = useMemo(() => {
    if (!computedData) {
      return { min: -height / 2, max: height / 2, visualOffset: 0, visualScale: 1 };
    }
    if (viewId && computedData.verticalAxisByView?.[viewId]) {
      return computedData.verticalAxisByView[viewId];
    }
    return { ...computedData.verticalBounds, visualOffset: 0, visualScale: 1 };
  }, [computedData, viewId, height]);

  const effectiveVerticalBounds = useMemo(
    () => ({ min: axisRange.min, max: axisRange.max }),
    [axisRange.max, axisRange.min],
  );

  if (!sourceRow) return null;
  if (!sourceRow || !computedData) return null;

  const resolvedSegmentColor =
    transitionLayer === LayerBand.ForegroundSelected ||
    transitionLayer === LayerBand.ForegroundUnselected
      ? color
      : DEFAULT_COLOR;

  return (
    <group
      position={[0, yOffset, baseZ]}
      onClick={() => console.log("clicked", sourceRow, computedData)} // Reserved no-op; marker/segment clicks stopPropagation and handle selection
    >
      {shouldRenderTrackSwitchOverlay && trackRender !== TrackRender.Spline && (
        <mesh
          position={[0.5, 0, Z.TrackSwitchingBoundary]}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={handleTrackSwitch}
          renderOrder={1000}
        >
          <planeGeometry args={[1, height]} />
          <meshBasicMaterial
            color="#000000"
            transparent
            opacity={0}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      )}
      {/* Render the hexagons/visuals for each keyed point */}
      {/* PROBLEM: frameData is passed as props here, creating stale references in DataPoint components */}
      {/* After drag operations, individual DataPoint components retain old stamp values */}
      {/* Phase 2+ will eliminate this prop drilling by having components subscribe to store directly */}
      <DataPointsRenderer
        sourceRow={sourceRow}
        frames={computedData.virtualFrames}
        verticalBounds={effectiveVerticalBounds}
        verticalAxisRange={axisRange}
        theme={theme}
        trackRender={trackRender}
        height={height - 1}
      />

      {/* Render transition segments */}
      {computedData.interpolations.map((segment, index) => {
        const renderMode = keyForced ? TrackRender.Key : trackRender;
        const handlesVisible = rowHandlesEligible && !segment.buffer;
        const handleAppearance = handlesDelayReady ? handlesAppearance : 0;

        return (
          <Fragment key={`${segment.start.id}-${segment.end.id}-${index.toString()}`}>
            <TransitionSegment
              trackRender={renderMode}
              height={height - 1}
              verticalBounds={effectiveVerticalBounds}
              sourceRow={sourceRow}
              segment={segment}
              theme={theme}
              verticalAxisRange={axisRange}
              onHoverChange={handleSegmentHoverChange}
              isRowHovered={isRowHovered}
              color={resolvedSegmentColor}
              layer={transitionLayer}
            />
            {handlesVisible && (
              <BezierHandles
                segment={segment}
                height={height - 1}
                verticalBounds={effectiveVerticalBounds}
                verticalAxisRange={axisRange}
                rowId={sourceRow.id}
                trackId={sourceRow.data[0]?.trackId}
                attributePath={
                  sourceRow.data[0]?.attribute ? [sourceRow.data[0].attribute] : undefined
                }
                color={resolvedSegmentColor}
                layer={transitionLayer}
                isHighlighted={isRowHovered}
                appearance={handleAppearance}
                theme={theme}
              />
            )}
          </Fragment>
        );
      })}

      {/* Render violations */}
      {trackRender !== TrackRender.Spline && (
        <ViolationRenderer
          violationSet={computedData.violationSet}
          theme={theme}
          height={height - 1}
          yOffset={scrollOffset}
          measureFromBottom={measureFromBottom}
          layer={transitionLayer}
        />
      )}

      {/* Render a background for the Active region, and the General Background */}
      {showBackground && trackIds.length > 0 && trackRender !== TrackRender.Spline && (
        <FrustumBackground
          color={
            transitionLayer === LayerBand.ForegroundSelected ||
            transitionLayer === LayerBand.ForegroundUnselected
              ? color
              : DEFAULT_COLOR
          }
          height={height - 1}
          z={Z.Background}
          onHoverChange={onEmphasisChange}
          emphasis={emphasis}
          theme={theme}
        />
      )}
    </group>
  );
});
