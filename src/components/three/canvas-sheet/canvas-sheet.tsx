import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Theme } from "@semio/ui";
import { MotionValue } from "motion";
import { PanZoomControls } from "../controls/pan-zoom-controls";
import { DataProvider } from "./data-context";
import { HudSection } from "./hud-section";
import { DataPointsRenderer } from "./data-points-renderer";
import { TrackList } from "./track-list";
import { DEFAULT_DATAPOINTS } from "./constants";
import { MinimapDisplay } from "./minimap-display";

export interface CanvasSheetProps {
  tracks?: string[];
  selection?: string[];
  scrollValue?: MotionValue<number>;
  theme?: Theme.Dark | Theme.Light;
  emphasis: string[];
  onEmphasisChange?: (id: string, opt: "add" | "remove") => void;
}

export function CanvasSheet({
  tracks = [],
  selection = [],
  scrollValue,
  theme = Theme.Light,
  emphasis = [],
  onEmphasisChange = () => {},
}: CanvasSheetProps) {
  const bgColor = theme === Theme.Dark ? "#202020" : "#EFEFEF";

  return (
    <DataProvider initial={DEFAULT_DATAPOINTS}>
      <Canvas
        className="w-full h-full"
        flat
        orthographic
        camera={{
          position: [0, 0, 100],
          up: [0, 1, 0],
          left: 0,
          right: 1,
          near: 0.1,
          far: 1000,
          manual: true,
        }}
        gl={{
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.NoToneMapping,
          antialias: true,
        }}
      >
        <ambientLight intensity={1} />
        <PanZoomControls bounds={[0, 1]} />
        <TrackList
          tracks={tracks}
          scrollValue={scrollValue}
          topOffsetPx={32}
          emphasis={emphasis}
          onEmphasisChange={onEmphasisChange}
        />

        {/* Top HUD: 32px tall */}
        <HudSection position="top" pixelHeight={32} backgroundColor={bgColor} renderPriority={1}>
          <DataPointsRenderer height={32} />
        </HudSection>

        {/* Timeline HUD: 36px tall */}
        <HudSection
          position="bottom"
          pixelHeight={36}
          backgroundColor={bgColor}
          renderPriority={2}
          gap={72}
        >
          <DataPointsRenderer height={36} tracks={selection} />
        </HudSection>

        {/* Minimap HUD: 36px tall */}
        <HudSection
          position="bottom"
          pixelHeight={36}
          gap={36}
          backgroundColor={bgColor}
          renderPriority={3}
          fixedCamera
        >
          <MinimapDisplay />
        </HudSection>

        {/* Bottom HUD: 36px tall, for bottom ruler */}
        <HudSection
          position="bottom"
          pixelHeight={36}
          backgroundColor={bgColor}
          renderPriority={4}
          fixedCamera
        >
          <DataPointsRenderer height={36} />
        </HudSection>
      </Canvas>
    </DataProvider>
  );
}
