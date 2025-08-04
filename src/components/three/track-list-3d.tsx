import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { ScrollArea } from "@semio/ui";
import { MotionValue } from "motion/react";
import { useAnimationStore } from "../../hooks";
import { AnimationInstanceSettings, TrackRender } from "../../types";
import { ControlWidget } from "../control-widget";

export interface TrackList3DProps {
  animationId: string;
  namespaceId: string;
  instanceSettings: AnimationInstanceSettings;
  trackRender: TrackRender;
  height?: number;
  scrollY?: MotionValue<number>;
}

export function TrackList3D({
  animationId,
  namespaceId,
  instanceSettings,
  trackRender: _trackRender,
  height = 240,
  scrollY,
}: TrackList3DProps): ReactNode {
  const tracks = useAnimationStore(
    useShallow((state) => Array.from(state.animations[animationId]?.tracks || [])),
  );

  return (
    <div
      className={clsx(
        "relative h-full w-[300px] dark:bg-black bg-neutral-100",
        "flex flex-col not-group-aria-expanded/sheet:hidden",
      )}
    >
      <ScrollArea
        orientation="vertical"
        className="pr-1"
        style={{ maxHeight: height }}
        motionScrollY={scrollY}
      >
        {tracks.map((trackId) => (
          <ControlWidget
            key={trackId}
            animationId={animationId}
            trackId={trackId}
            namespace={namespaceId}
            instanceSettings={instanceSettings}
            onExpandedChange={() => {}}
            emphasis={false}
            onEmphasisChange={() => {}}
          />
        ))}
      </ScrollArea>
    </div>
  );
}
