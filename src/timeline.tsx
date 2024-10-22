import { CSSProperties, type ReactNode } from "react";
import { ParentSize } from "@visx/responsive";
import { Track } from "./track";
import { AnimationData } from "./store-types";
import { useAnimationStore } from "./hooks/use-animation-store";

export function Timeline({ trackIds }: { trackIds?: string[] }): ReactNode {
  const color = useAnimationStore((state: AnimationData) => {
    if (trackIds === undefined || trackIds?.length === 0 || trackIds?.length > 1) return "#737373";
    const control = Object.values(state.controls).find((ctrl) => ctrl.writeId === trackIds[0]);
    return control?.settings?.color || "#737373";
  });
  return (
    <div
      className="cursor-pointer items-center w-full"
      style={{ "--track-color": color } as CSSProperties}
    >
      <ParentSize debounceTime={10}>
        {({ width }) => <Track width={width} trackIds={trackIds} canZoom />}
      </ParentSize>
    </div>
  );
}
