import { CSSProperties, type ReactNode, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { ParentSize } from "@visx/responsive";
import { Track } from "./track";
import type { AnimationData } from "./store-types";
import { useAnimationStore } from "./hooks/use-animation-store";
import { ControlWidget } from "./control-widget";

export function TrackRow({ trackIds }: { trackIds?: string[] }): ReactNode {
  const [expanded, setExpanded] = useState(false);
  const [emphasis, setEmphasis] = useState(false);

  const track: string = trackIds?.[0] ?? "all";

  const control = useAnimationStore(
    useShallow((state: AnimationData) => {
      if (track && track !== "all") {
        return Object.values(state.controls).filter(
          (c) => c.writeId === track,
        )[0];
      } else {
        return undefined;
      }
    }),
  );

  if (!control) {
    return null;
  }

  return (
    <div className="flex flex-row items-center">
      <div className="w-[calc(100vw-40px)] xs:w-64 transition-[width] flex flex-row">
        <ControlWidget
          animatableId={control.readId}
          namespace="default"
          onExpandedChange={setExpanded}
          emphasis={emphasis}
          onEmphasisChange={setEmphasis}
        />
      </div>
      <div
        className="cursor-pointer items-center flex flex-1"
        style={
          {
            "--track-color": control.settings.color || "#737373",
          } as CSSProperties
        }
      >
        <ParentSize debounceTime={10}>
          {({ width }) => {
            if (expanded) {
              return (
                <div className="flex-1 flex flex-col">
                  <Track
                    width={width}
                    trackIds={trackIds}
                    useCustomColor
                    canZoom
                    emphasis={emphasis}
                    onEmphasisChange={setEmphasis}
                  />
                  <Track
                    width={width}
                    trackIds={trackIds}
                    useCustomColor
                    canZoom
                    emphasis={emphasis}
                    onEmphasisChange={setEmphasis}
                  />
                  <Track
                    width={width}
                    trackIds={trackIds}
                    useCustomColor
                    canZoom
                    emphasis={emphasis}
                    onEmphasisChange={setEmphasis}
                  />
                  <Track
                    width={width}
                    trackIds={trackIds}
                    useCustomColor
                    canZoom
                    emphasis={emphasis}
                    onEmphasisChange={setEmphasis}
                  />
                </div>
              );
            } else {
              return (
                <Track
                  width={width}
                  trackIds={trackIds}
                  useCustomColor
                  canZoom
                  emphasis={emphasis}
                  onEmphasisChange={setEmphasis}
                />
              );
            }
          }}
        </ParentSize>
      </div>
    </div>
  );
}
