import type { ReactNode } from "react";
import { useContext, memo, useState, useEffect, useRef, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import useMeasure from "react-use-measure";
import { Canvas, useFrame } from "@react-three/fiber";
import { ToggleGroup, Size, ToggleSquare, IconPreviewView, ScrollArea, type ScrollInfo } from "@semio/ui";
import { IconArrowUpRight, IconChevronDown, IconLine, IconTable } from "@tabler/icons-react";
import { AnimationContext } from "../../context";
import { useDefaultAnimationStore } from "../../store";
import { TrackRender, AnimationInstance, AnimationInstanceSettings } from "../../types";
import { useAnimationStore, ColorContextProvider } from "../../hooks";
import { ControlWidget } from "../control-widget";
import { TimelineControl } from "../timeline-control";
import { TimeControls } from "../time-controls";
import { PlaybackSettings } from "../playback-settings";
import * as THREE from "three";

const MIN_SHEET_HEIGHT = 142;
const LEFT_COLUMN_WIDTH = 320;

export interface AnimationSheetTwoColumnProps {
  namespaceId: string;
  animationInstances: Record<string, AnimationInstance>;
  onToggleExpand?: (expanded: boolean) => void;
  height?: number;
}

interface SyncState {
  scrollTop: number;
  scrollLeft: number;
  timePosition: number;
  visibleTrackRange: { start: number; end: number };
}

function TrackRowControl({
  trackId,
  animationId,
  namespaceId,
  instanceSettings,
}: {
  trackId: string;
  animationId: string;
  namespaceId: string;
  instanceSettings: AnimationInstanceSettings;
}) {
  const track = useAnimationStore(useShallow((state) => state.tracks[trackId]));
  const animatable = useAnimationStore(
    useShallow((state) => state.animatables[track?.animatableId || ""]),
  );

  if (!track || !animatable) {
    return null;
  }

  return (
    <div className="h-[60px] border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      <ControlWidget
        animationId={animationId}
        animatableId={track.animatableId}
        namespace={namespaceId}
        instanceSettings={instanceSettings}
        onExpandedChange={() => {}}
        emphasis={false}
        onEmphasisChange={() => {}}
      />
    </div>
  );
}

function LeftColumn({
  namespaceId,
  animationId,
  instanceSettings,
  selectedTracks,
  allTracks,
  onChangeSelection,
  trackRender,
  setTrackRender,
  expanded,
  onToggleExpand,
  height,
  syncState,
  onSyncStateChange,
}: {
  namespaceId: string;
  animationId: string;
  instanceSettings: AnimationInstanceSettings;
  selectedTracks: string[];
  allTracks: string[];
  onChangeSelection: (tracks: string[]) => void;
  trackRender: TrackRender;
  setTrackRender: (render: TrackRender) => void;
  expanded: boolean;
  onToggleExpand?: (expanded: boolean) => void;
  height: number;
  syncState: SyncState;
  onSyncStateChange: (state: Partial<SyncState>) => void;
}) {
  const tracks = useAnimationStore(
    useShallow((state) => Array.from(state.animations[animationId]?.tracks || [])),
  );

  const handleScrollChange = useCallback((scrollInfo: ScrollInfo) => {
    onSyncStateChange({
      scrollTop: scrollInfo.scrollTop,
    });
  }, [onSyncStateChange]);

  return (
    <div
      className="flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700"
      style={{ width: LEFT_COLUMN_WIDTH }}
    >
      {/* Header Controls */}
      <div className="h-8 flex items-center justify-between px-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
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

      {/* Track List */}
      {expanded && (
        <div className="flex-1 overflow-hidden">
          <ScrollArea
            orientation="vertical"
            style={{ maxHeight: height - MIN_SHEET_HEIGHT }}
            scrollTop={syncState.scrollTop}
            onScrollChange={handleScroll
