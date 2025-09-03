import type { ReactNode } from "react";
import { memo, useState, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import useMeasure from "react-use-measure";
import { ToggleGroup, Size, ToggleSquare, IconPreviewView } from "@semio/ui";
import { IconArrowUpRight, IconChevronDown, IconLine, IconTable } from "@tabler/icons-react";
import { AnimationContext } from "../context";
import { useDefaultAnimationStore } from "../store";
import { TrackRender, AnimationInstance } from "../types";
import { useAnimationStore, ColorContextProvider } from "../hooks";
import { WithAnimationContextProps, useOptionalContext } from "../utils/context-providers";
import { DEFAULT_TRACK_HEIGHT } from "../constants";
import { Timeline } from "./timeline";
import { TrackList } from "./track-list";
import { Minimap } from "./minimap";
import { Ruler } from "./ruler";
import { TimelineControl } from "./timeline-control";
import { TimeControls } from "./time-controls";
import { PlaybackSettings } from "./playback-settings";

const TRACK_MAIN_BG = "dark:bg-[#202020] bg-[#efefef]";
const MIN_SHEET_HEIGHT = 142;

export interface AnimationSheetProps extends WithAnimationContextProps {
  namespaceId: string;
  animationInstances: Record<string, AnimationInstance>;
  onToggleExpand?: (expanded: boolean) => void;
  height?: number;
}

export interface AnimationSheetCoreProps {
  namespaceId: string;
  animationInstances: Record<string, AnimationInstance>;
  onToggleExpand?: (expanded: boolean) => void;
  height?: number;
}

/**
 * Core AnimationSheet component that requires AnimationContext to be provided by a parent.
 *
 * Use this component when:
 * - You know AnimationContext is already provided by a parent component
 * - You want to avoid automatic context provision (for performance or control)
 * - You're testing the component in isolation with a known context
 *
 * @example
 * ```tsx
 * // Use when context is already provided
 * <AnimationContext.Provider value={myStore}>
 *   <AnimationSheetCore
 *     namespaceId="demo"
 *     animationInstances={instances}
 *   />
 * </AnimationContext.Provider>
 * ```
 *
 * @throws Error if AnimationContext is not provided by a parent component
 */
export const AnimationSheetCore = memo(function AnimationSheetCore(
  props: AnimationSheetCoreProps,
): ReactNode {
  return <InnerSheet {...props} />;
});

/**
 * Full AnimationSheet component that automatically provides AnimationContext if needed.
 * This is the main export that most consumers should use.
 *
 * Context Behavior:
 * - If no AnimationContext exists in the component tree, creates one with default store
 * - If AnimationContext already exists, uses the existing one (no nesting)
 * - Use `skipAnimationContext={true}` to always use parent context (throws if none exists)
 *
 * @param skipAnimationContext - Skip providing context, assume parent provides it
 *
 * @example
 * ```tsx
 * // Automatic context provision (recommended for most cases)
 * <AnimationSheet namespaceId="demo" animationInstances={instances} />
 *
 * // Skip context when parent provides it
 * <AnimationContext.Provider value={myCustomStore}>
 *   <AnimationSheet
 *     skipAnimationContext
 *     namespaceId="demo"
 *     animationInstances={instances}
 *   />
 * </AnimationContext.Provider>
 *
 * // Nested usage (inner skips context)
 * <AnimationSheet namespaceId="outer" animationInstances={outer}>
 *   <AnimationSheet
 *     skipAnimationContext
 *     namespaceId="inner"
 *     animationInstances={inner}
 *   />
 * </AnimationSheet>
 * ```
 */
export function AnimationSheet({
  skipAnimationContext = false,
  ...props
}: AnimationSheetProps): ReactNode {
  const ctx = useOptionalContext(AnimationContext);
  const needsAnimationContext = !skipAnimationContext && !ctx;

  let content = <AnimationSheetCore {...props} />;

  if (needsAnimationContext) {
    content = (
      <AnimationContext.Provider value={useDefaultAnimationStore}>
        {content}
      </AnimationContext.Provider>
    );
  }

  return content;
}

function InnerSheet({
  namespaceId,
  animationInstances,
  onToggleExpand,
  height = MIN_SHEET_HEIGHT,
}: AnimationSheetCoreProps): ReactNode {
  // TODO: Eventually we will allow seleciton of different animation instances to view. For now we assume there is only one instance per set.
  const [trackRender, setTrackRender] = useState<TrackRender>(TrackRender.Key);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const { animations, updateDuration } = useAnimationStore(
    useShallow((state) => {
      return {
        animations: state.animations,
        updateDuration: state.updateDuration,
      };
    }),
  );

  const currentAnimationInstance = Object.values(animationInstances || {})[0];
  const currentAnimation = currentAnimationInstance?.animationId;
  const instanceSettings = currentAnimationInstance?.settings;
  useEffect(() => {
    if (!currentAnimation || !animations[currentAnimation]) {
      return;
    }
    setSelectedTracks(animations[currentAnimation]?.tracks || []);
    updateDuration(animations[currentAnimation].duration);
  }, [currentAnimation, animations, updateDuration]);

  const [trackRegion, trackBounds] = useMeasure();

  if (!currentAnimation || !animations[currentAnimation]) {
    return null;
  }

  const allTracks = animations[currentAnimation]?.tracks || [];

  const expanded = height > MIN_SHEET_HEIGHT;

  return (
    <ColorContextProvider>
      <div
        aria-expanded={expanded}
        style={{
          height,
          minHeight: MIN_SHEET_HEIGHT,
        }}
        className={clsx(
          "grid grid-cols-[298px_1fr] group/sheet w-full gap-x-1 pr-0.5 pb-0.5",
          "grid-rows-[32px_1fr_36px_36px_36px]",
        )}
      >
        {/* Expand Toggle/Ruler */}
        <div className={clsx("flex flex-1 flex-row h-8 items-center justify-between pl-1")}>
          <ToggleSquare
            sizing="inner"
            size={Size.Sm}
            value={expanded}
            onChange={(v) => onToggleExpand?.(v)}
            label="Expand Tracks"
          >
            <IconChevronDown
              size="11px"
              className={clsx(
                expanded ? "rotate-0" : "rotate-180",
                "transition-transform ease-in-out",
              )}
            />
          </ToggleSquare>

          <ToggleGroup
            bg
            visuals="icons"
            size={Size.Sm}
            value={trackRender}
            onChange={(v: string) => {
              setTrackRender(v as TrackRender);
            }}
            options={[
              {
                value: TrackRender.Key,
                label: "Key View",
                icon: <IconLine size="11px" className="rotate-45" />,
              },
              {
                value: TrackRender.Transition,
                label: "Transition View",
                icon: <IconLine size="11px" />,
              },
              {
                value: TrackRender.Preview,
                label: "Preview View",
                // icon: <IconEaseInOut size="11px" />,
                icon: <IconPreviewView size="11px" />,
              },
              {
                value: TrackRender.Data,
                label: "Data View",
                icon: <IconTable size="11px" />,
                disabled: true,
              },
            ]}
          />
          <ToggleSquare
            sizing="inner"
            size={Size.Sm}
            value={false}
            onChange={() => {}}
            label="Pop Out"
            disabled
          >
            <IconArrowUpRight size="11px" />
          </ToggleSquare>
        </div>
        <div
          ref={trackRegion}
          className={clsx("flex-1 h-8 text-black dark:text-white rounded-t-sm", TRACK_MAIN_BG)}
        >
          <Ruler side="top" animationId={currentAnimation} height={32} width={trackBounds.width} />
        </div>

        <div className="col-span-2">
          {/* Tracks */}
          <TrackList
            animationId={currentAnimation}
            namespaceId={namespaceId}
            trackRender={trackRender}
            instanceSettings={instanceSettings}
            width={trackBounds.width}
            // Subtract the height of the other elements from the total height
            height={height - MIN_SHEET_HEIGHT}
          />
        </div>

        <TimelineControl
          animationId={currentAnimation}
          namespaceId={namespaceId}
          instanceSettings={instanceSettings}
          selection={selectedTracks}
          allTracks={allTracks}
          onChangeSelection={setSelectedTracks}
        />

        <div className={clsx("w-full", TRACK_MAIN_BG)}>
          <Timeline
            height={DEFAULT_TRACK_HEIGHT}
            width={trackBounds.width}
            trackIds={selectedTracks}
            animationId={currentAnimation}
            namespaceId={namespaceId}
            instanceSettings={instanceSettings}
            trackRender={
              ([TrackRender.Key, TrackRender.Preview, TrackRender.Transition].includes(trackRender)
                ? trackRender
                : TrackRender.Key) as TrackRender.Key | TrackRender.Preview | TrackRender.Transition
            }
          />
        </div>

        <TimeControls
          animationId={currentAnimation}
          namespaceId={namespaceId}
          instanceSettings={instanceSettings}
          selection={selectedTracks}
          allTracks={allTracks}
          onChangeSelection={setSelectedTracks}
        />

        <div className={clsx("w-full h-9 items-center text-black dark:text-white", TRACK_MAIN_BG)}>
          <Minimap
            animationId={currentAnimation}
            instanceSettings={instanceSettings}
            width={trackBounds.width}
          />
        </div>

        <PlaybackSettings />
        <div className={clsx("flex-1 h-9 text-black dark:text-white rounded-b-sm", TRACK_MAIN_BG)}>
          <Ruler
            side="bottom"
            animationId={currentAnimation}
            height={36}
            width={trackBounds.width}
          />
        </div>
      </div>
    </ColorContextProvider>
  );
}
