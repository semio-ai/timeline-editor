import {
  Fragment,
  memo,
  useMemo,
  useCallback,
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
} from "react";
import { useShallow } from "zustand/shallow";
import { Theme } from "@semio/ui";
import { MotionValue } from "motion";
import { animate, useMotionValue, useMotionValueEvent, useSpring } from "motion/react";
import { Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { uniq } from "lodash";
import { isOrthographicCamera } from "@semio/utils";
import { useAnimationStore, useColors, useLocalGlobalTransformLookup } from "../../hooks";
import {
  LayerBand,
  SelectionFrame,
  SourceRow,
  TrackRender,
  VerticalAxis,
  VerticalAxisRange,
} from "../../types";
import { AnimationData, AnimationActions } from "../../store-types";
import { DEFAULT_COLOR, RENDER_MORPH_SPRING, Z } from "../../constants";
import { DataPoint } from "./data-point";
import { FrustumBackground } from "./frustum-background";
import { ViolationRenderer } from "./violation-renderer";
import { TransitionSegment } from "./transition-segment";
import { BezierHandles } from "./bezier-handles";

const HANDLE_REVEAL_DELAY_MS = 120;

const DataPointsRenderer = memo(function DataPointsRenderer({
  sourceRow,
  selectionFrames,
  activeInstanceId,
  xTransform,
  verticalBounds,
  verticalAxisRange,
  theme = Theme.Light,
  trackRender = TrackRender.Key,
  renderMorphProgress,
  height = 36,
  colorOverride,
  holdCountDuringDrag = false,
}: {
  sourceRow: SourceRow;
  selectionFrames: SelectionFrame[];
  activeInstanceId?: string | null;
  xTransform?: (stamp: number) => number;
  verticalBounds: { min: number; max: number };
  verticalAxisRange?: VerticalAxisRange;
  theme?: Theme.Light | Theme.Dark;
  trackRender?: TrackRender;
  renderMorphProgress?: MotionValue<number>;
  height?: number;
  colorOverride?: string;
  holdCountDuringDrag?: boolean;
}) {
  const instanceCount = selectionFrames.length * 2;
  const stableCountRef = useRef(instanceCount);
  const wasHoldingRef = useRef(false);

  useEffect(() => {
    // Why hold the count during drag:
    // - The derived selection frame list can transiently shrink/grow while dragging
    //   (e.g. overlap/collision previews or merge-like visual states).
    // - If we let those temporary count changes feed the Instances key, React remounts
    //   the instanced mesh mid-gesture.
    // - That remount can interrupt pointer/drag continuity.
    //
    // So we freeze the "key count" at drag start and release it when drag ends.
    if (holdCountDuringDrag) {
      if (!wasHoldingRef.current) {
        stableCountRef.current = instanceCount;
      }
    } else {
      stableCountRef.current = instanceCount;
    }
    wasHoldingRef.current = holdCountDuringDrag;
  }, [holdCountDuringDrag, instanceCount]);

  const keyInstanceCount = holdCountDuringDrag ? stableCountRef.current : instanceCount;

  // Keep instanced children mounted during drag.
  // Outside drag, remount on row/instance/count changes so empty/non-empty transitions refresh
  // instance buffers correctly for new animations.
  const instancesKey = `${sourceRow.id}:${activeInstanceId ?? "none"}:${String(keyInstanceCount)}`;

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
      {selectionFrames.map((frame) => (
        <DataPoint
          key={frame.id}
          markerId={frame.id}
          sourceRowId={sourceRow.id}
          theme={theme}
          trackRender={trackRender}
          renderMorphProgress={renderMorphProgress}
          xTransform={xTransform}
          height={height}
          verticalBounds={verticalBounds}
          verticalAxisRange={verticalAxisRange}
          colorOverride={colorOverride}
        />
      ))}
    </Instances>
  );
});

export interface DataRendererProps {
  sourceRowId: string;
  height?: number;
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
  const renderSampleCache = useAnimationStore(
    useShallow((state: StoreState) => state.derivedSnapshot?.renderSampleCache),
  );
  const selectionState = useAnimationStore(useShallow((state: StoreState) => state.selectionState));
  const hasActiveDrag = useAnimationStore(
    useShallow((state: StoreState) => Boolean(state.dragState)),
  );
  const focusSelectionInstance = useAnimationStore(
    useShallow((state: StoreState) => state.focusSelectionInstance),
  );
  const emphasis = useAnimationStore(
    useShallow((state: StoreState) => state.emphasisRowId === sourceRowId),
  );
  const setEmphasis = useAnimationStore(
    useShallow((state: StoreState) => state.setEmphasis),
  );

  const trackIds = useMemo(
    () => (sourceRow ? uniq(sourceRow.data.map((s) => s.trackId)) : []),
    [sourceRow],
  );
  const rowMuted = useMemo(() => {
    if (!sourceRow || sourceRow.data.length === 0) return false;
    return sourceRow.data.every((entry) => entry.muted ?? false);
  }, [sourceRow]);
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
  const xInverse = useMemo(() => {
    const transform =
      rowInstanceId && localGlobalTransformLookup.toLocal[rowInstanceId]
        ? localGlobalTransformLookup.toLocal[rowInstanceId]
        : undefined;
    if (typeof transform === "function") {
      return transform;
    }
    return (stamp: number) => stamp;
  }, [localGlobalTransformLookup, rowInstanceId]);
  const xScale = useMemo(() => {
    const scaled = xTransform(1) - xTransform(0);
    return Number.isFinite(scaled) && scaled !== 0 ? scaled : 1;
  }, [xTransform]);
  const renderMarkers = computedData?.render?.markers ?? [];
  const renderHandles = computedData?.render?.handles ?? [];
  const transitionLayer: LayerBand = useMemo(() => {
    const markers = computedData?.render?.markers ?? [];
    const allLayers = uniq(markers.map((marker) => marker.layerBand ?? LayerBand.Background));
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
  }, [computedData?.render?.markers]);
  const baseColor = useColors(trackIds);
  const color = rowMuted ? DEFAULT_COLOR : baseColor;
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
  const renderMode = keyForced ? TrackRender.Key : trackRender;

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

  const renderMorphProgress = useMotionValue(1);
  const renderMorphAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
  const previousRenderModeRef = useRef(renderMode);
  const verticalAxisSetting = useAnimationStore(
    useShallow((state: StoreState) =>
      viewId
        ? (state.editorViews[viewId]?.verticalAxis ?? VerticalAxis.Normalized)
        : VerticalAxis.Normalized,
    ),
  );
  const previousVerticalAxisRef = useRef(verticalAxisSetting);
  useLayoutEffect(() => {
    const renderChanged = previousRenderModeRef.current !== renderMode;
    const verticalAxisChanged = previousVerticalAxisRef.current !== verticalAxisSetting;
    const shouldAnimateVerticalAxisChange =
      renderMode === TrackRender.Spline && verticalAxisChanged;
    renderMorphAnimationRef.current?.stop();
    if (renderChanged || shouldAnimateVerticalAxisChange) {
      renderMorphProgress.set(0);
      renderMorphAnimationRef.current = animate(renderMorphProgress, 1, RENDER_MORPH_SPRING);
    } else {
      renderMorphProgress.set(1);
    }
    previousRenderModeRef.current = renderMode;
    previousVerticalAxisRef.current = verticalAxisSetting;
    return () => {
      renderMorphAnimationRef.current?.stop();
    };
  }, [renderMode, renderMorphProgress, verticalAxisSetting]);

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
      onClick={() => console.log("clicked row", JSON.stringify(computedData?.selection))} // Reserved no-op; marker/segment clicks stopPropagation and handle selection
      onDoubleClick={() => {
        console.log("clicked row", JSON.stringify(computedData?.selection));
      }}
    >
      {shouldRenderTrackSwitchOverlay && trackRender !== TrackRender.Spline && (
        <TrackSwitchOverlay
          height={height}
          onClick={handleTrackSwitch}
        />
      )}
      {/* Render the hexagons/visuals for each keyed point */}
      {/* Note: selection frames are passed as props for instancing; DataPoint subscribes to store data */}
      <DataPointsRenderer
        sourceRow={sourceRow}
        selectionFrames={computedData.selection ?? []}
        activeInstanceId={selectionState.instanceId}
        xTransform={xTransform}
        verticalBounds={effectiveVerticalBounds}
        verticalAxisRange={axisRange}
        theme={theme}
        trackRender={renderMode}
        renderMorphProgress={renderMorphProgress}
        height={height - 1}
        colorOverride={rowMuted ? DEFAULT_COLOR : undefined}
        holdCountDuringDrag={hasActiveDrag}
      />

      {/* Render transition segments */}
      {(computedData.render?.segments ?? []).map((segment) => {
        return (
          <Fragment key={segment.id}>
            <TransitionSegment
              trackRender={renderMode}
              verticalAxis={verticalAxisSetting}
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
              renderSampleCache={renderSampleCache}
              renderMorphProgress={renderMorphProgress}
            />
          </Fragment>
        );
      })}
      {rowHandlesEligible && handlesDelayReady && renderHandles.length > 0 && (
        <BezierHandles
          handles={renderHandles}
          markers={renderMarkers}
          height={height - 1}
          verticalBounds={effectiveVerticalBounds}
          verticalAxisRange={axisRange}
          rowId={sourceRow.id}
          color={resolvedSegmentColor}
          layer={transitionLayer}
          isHighlighted={isRowHovered}
          appearance={handlesAppearance}
          theme={theme}
          xTransform={xTransform}
          xInverse={xInverse}
          xScale={xScale}
        />
      )}

      {/* Render violations */}
      {trackRender !== TrackRender.Spline && (
        <ViolationRenderer
          violationSet={computedData.violationSet}
          theme={theme}
          height={height - 1}
          yOffset={scrollOffset}
          measureFromBottom={measureFromBottom}
          layer={transitionLayer}
          xTransform={xTransform}
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
          onHoverChange={(hovered) => setEmphasis(hovered ? sourceRowId : null)}
          emphasis={emphasis}
          theme={theme}
        />
      )}
    </group>
  );
});

/** Invisible overlay that intercepts clicks to switch the active animation instance.
 *  Uses useFrame to cover the full camera frustum regardless of viewport position. */
const TrackSwitchOverlay = memo(function TrackSwitchOverlay({
  height,
  onClick,
}: {
  height: number;
  onClick: (event?: { stopPropagation?: () => void }) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ camera }) => {
    if (!meshRef.current || !isOrthographicCamera(camera)) return;
    const w = camera.right - camera.left;
    if (w <= 0) return;
    meshRef.current.position.x = (camera.left + camera.right) / 2;
    meshRef.current.scale.x = w;
  });

  return (
    <mesh
      ref={meshRef}
      position={[0, 0, Z.TrackSwitchingBoundary]}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
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
  );
});
