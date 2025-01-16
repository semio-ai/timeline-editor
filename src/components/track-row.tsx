import { CSSProperties, type ReactNode, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { ParentSize } from "@visx/responsive";
import type { AnimationData } from "../store-types";
import { TrackRender, AnimationInstanceSettings } from "../types";
import { useAnimationStore } from "../hooks";
import { ControlWidget } from "./control-widget";
import { Track } from "./track";

export function TrackRow({
  trackIds,
  animationId,
  namespaceId,
  instanceSettings,
  trackRender,
}: {
  trackIds?: string[];
  animationId: string;
  namespaceId: string;
  instanceSettings: AnimationInstanceSettings;
  trackRender: TrackRender;
}): ReactNode {
  const [expanded, setExpanded] = useState(false);
  const [emphasis, setEmphasis] = useState(false);

  const track: string = trackIds?.[0] ?? "all";

  const trackObject = useAnimationStore(
    useShallow((state: AnimationData) => {
      if (track && track !== "all") {
        return state.tracks[track];
      } else {
        return undefined;
      }
    }),
  );

  if (!trackObject) {
    return null;
  }

  return (
    <div className="flex flex-row items-center">
      <div className="w-[calc(100vw-40px)] xs:w-64 transition-[width] flex flex-row">
        <ControlWidget
          animationId={animationId}
          animatableId={trackObject.animatableId}
          namespace={namespaceId}
          instanceSettings={instanceSettings}
          onExpandedChange={setExpanded}
          emphasis={emphasis}
          onEmphasisChange={setEmphasis}
        />
      </div>
      <div
        className="cursor-pointer items-center flex flex-1"
        style={
          {
            "--track-color": trackObject.settings?.color || "#737373",
          } as CSSProperties
        }
      >
        <ParentSize debounceTime={10}>
          {({ width }) => {
            if (expanded) {
              return (
                <div className="flex-1 flex flex-col">
                  <Track
                    animationId={animationId}
                    namespaceId={namespaceId}
                    instanceSettings={instanceSettings}
                    width={width}
                    trackIds={trackIds}
                    useCustomColor
                    color={trackObject.settings?.color || "#737373"}
                    canZoom
                    emphasis={emphasis}
                    onEmphasisChange={setEmphasis}
                    trackRender={trackRender}
                  />
                  <Track
                    animationId={animationId}
                    namespaceId={namespaceId}
                    instanceSettings={instanceSettings}
                    attribute="x"
                    width={width}
                    trackIds={trackIds}
                    useCustomColor
                    color={trackObject.settings?.color || "#737373"}
                    canZoom
                    emphasis={emphasis}
                    onEmphasisChange={setEmphasis}
                    trackRender={trackRender}
                  />
                  <Track
                    animationId={animationId}
                    namespaceId={namespaceId}
                    instanceSettings={instanceSettings}
                    attribute="y"
                    width={width}
                    trackIds={trackIds}
                    useCustomColor
                    color={trackObject.settings?.color || "#737373"}
                    canZoom
                    emphasis={emphasis}
                    onEmphasisChange={setEmphasis}
                    trackRender={trackRender}
                  />
                  <Track
                    animationId={animationId}
                    namespaceId={namespaceId}
                    instanceSettings={instanceSettings}
                    attribute="z"
                    width={width}
                    trackIds={trackIds}
                    useCustomColor
                    color={trackObject.settings?.color || "#737373"}
                    canZoom
                    emphasis={emphasis}
                    onEmphasisChange={setEmphasis}
                    trackRender={trackRender}
                  />
                </div>
              );
            } else {
              return (
                <Track
                  animationId={animationId}
                  namespaceId={namespaceId}
                  instanceSettings={instanceSettings}
                  width={width}
                  trackIds={trackIds}
                  useCustomColor
                  color={trackObject.settings?.color || "#737373"}
                  canZoom
                  emphasis={emphasis}
                  onEmphasisChange={setEmphasis}
                  trackRender={trackRender}
                />
              );
            }
          }}
        </ParentSize>
      </div>
    </div>
  );
}
