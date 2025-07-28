import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { View } from "@react-three/drei";
import { ScrollArea } from "@semio/ui";
import { useAnimationStore } from "../../hooks";
import { AnimationInstanceSettings, TrackRender } from "../../types";
import { ControlWidget } from "../control-widget";

export interface TrackList3DProps {
  animationId: string;
  namespaceId: string;
  instanceSettings: AnimationInstanceSettings;
  trackRender: TrackRender;
  height?: number;
}

function TrackRow3D({
  trackId,
  animationId,
  namespaceId,
  instanceSettings,
}: {
  trackId: string;
  animationId: string;
  namespaceId: string;
  instanceSettings: AnimationInstanceSettings;
  trackRender: TrackRender;
}): ReactNode {
  const track = useAnimationStore(useShallow((state) => state.tracks[trackId]));

  const animatable = useAnimationStore(
    useShallow((state) => state.animatables[track?.animatableId || ""]),
  );

  if (!track || !animatable) {
    return null;
  }

  return (
    <ControlWidget
      animationId={animationId}
      animatableId={track.animatableId}
      namespace={namespaceId}
      instanceSettings={instanceSettings}
      onExpandedChange={() => {}}
      emphasis={false}
      onEmphasisChange={() => {}}
    />
  );
}

export function TrackList3D({
  animationId,
  namespaceId,
  instanceSettings,
  trackRender,
  height = 240,
}: TrackList3DProps): ReactNode {
  const tracks = useAnimationStore(
    useShallow((state) => Array.from(state.animations[animationId]?.tracks || [])),
  );

  return (
    <div
      className={clsx(
        "relative h-full w-full overflow-hidden dark:bg-black bg-neutral-100",
        "grid grid-cols-[298px_1fr] gap-x-1 not-group-aria-expanded/sheet:hidden",
      )}
    >
      <ScrollArea orientation="vertical" style={{ maxHeight: height }}>
        {tracks.map((track) => (
          <TrackRow3D
            key={track}
            animationId={animationId}
            trackId={track}
            namespaceId={namespaceId}
            instanceSettings={instanceSettings}
            trackRender={trackRender}
          />
        ))}
      </ScrollArea>
      <View className="w-full h-full">
        <color attach="background" args={["beige"]} />
      </View>
    </div>
  );
}
