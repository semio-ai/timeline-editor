import { memo, useContext } from "react";
import { Theme, useCanvasContextMenu } from "@semio/ui";
import { ThreeEvent } from "@react-three/fiber";
import { usePlaybackGestures, useBoxSelectGesture } from "../../hooks";
import { TrackRender } from "../../types";
import { Z } from "../../constants";
import { AnimationContext } from "../../context";
import { DataRenderer } from "./data-renderer";
import { HoverMarker } from "./overlays/hover-marker";
import { PlayheadMarker } from "./overlays/playhead-marker";
import { FrustumBackground } from "./frustum-background";
import { BoxSelectOverlay } from "./overlays/box-select-overlay";
import { BoundsOverlay } from "./overlays/bounds-overlay";
import { TickBackground } from "./overlays/tick-background";
import { buildTrackMenuItems } from "./context-menus";

export interface TimelineRendererProps {
  theme?: Theme.Light | Theme.Dark;
  viewId: string;
}

export const TimelineRenderer = memo(function TimelineRenderer({
  theme = Theme.Light,
  viewId,
}: TimelineRendererProps) {
  // Add playback gestures for seeking and hover preview
  const playbackGestures = usePlaybackGestures();
  const boxSelectPointerDown = useBoxSelectGesture("timeline", { viewId });
  const animationStore = useContext(AnimationContext);

  const { onContextMenu } = useCanvasContextMenu({
    items: (ctx) => buildTrackMenuItems(ctx, animationStore),
  });

  return (
    <>
      <mesh position={[0.5, 0, Z.ForegroundBackgroundBoundary]} raycast={() => {}}>
        <planeGeometry args={[1.1, 36]} />
        <meshBasicMaterial
          color={theme === Theme.Dark ? "#000000" : "#FFFFFF"}
          transparent
          opacity={0.4}
        />
      </mesh>
      <mesh position={[0.5, 0, Z.SelectedUnselectedBoundary]} raycast={() => {}}>
        <planeGeometry args={[1.1, 36]} />
        <meshBasicMaterial
          color={theme === Theme.Dark ? "#000000" : "#FFFFFF"}
          transparent
          opacity={0.3}
        />
      </mesh>
      <TickBackground height={36} theme={theme} />
      <HoverMarker height={36} theme={theme} />
      <PlayheadMarker height={36} theme={theme} />
      <BoundsOverlay height={36} theme={theme} />
      <BoxSelectOverlay origin="timeline" fixedHeight={36} />
      <DataRenderer
        height={36}
        sourceRowId="global"
        viewId={viewId}
        theme={theme}
        measureFromBottom
        showBackground={false}
        trackRender={TrackRender.Key}
      />
      <FrustumBackground
        height={36}
        visibility="transparent"
        z={Z.Violations - 1}
        pointerEvents={{
          ...playbackGestures,
          onPointerDown: boxSelectPointerDown,
          onPointerOver: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(),
          onContextMenu,
        }}
      />
    </>
  );
});
