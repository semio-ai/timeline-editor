import { CSSProperties, memo, useCallback, useMemo, useState } from "react";
import {
  Button,
  Dropdown,
  IconGraphView,
  IconKey,
  IconUniform,
  IconVectorAngled,
  IconVectorBezier,
  IconVectorBezierHandles,
  IconVectorFlat,
  IconVertexFree,
  IconVertexPaired,
  IconVerticalNormalize,
  NestedLabel,
  NestedRadio,
  NestedSeparator,
  Size,
  ToggleSquare,
} from "@semio/ui";
import { useShallow } from "zustand/shallow";
import {
  IconArrowLeft,
  IconArrowRight,
  IconArrowUpRight,
  IconChevronDown,
  IconLayout2,
} from "@tabler/icons-react";
import { clsx } from "clsx";
import { StandardTransitionType, TrackRender, TransitionPairing, VerticalAxis } from "../types";
import { useAnimationStore, useColors } from "../hooks";

export interface KeyToolbarSectionProps {}

export const KeyToolbarSection = memo(function KeyToolbarSection({}: KeyToolbarSectionProps) {
  const keypointSelectionMap = useAnimationStore(
    useShallow((state) => state.selectionState.keypoints),
  );

  const { selectedTracks, selectedKeys } = useMemo(() => {
    const tracks: string[] = [];
    const keys: string[] = [];

    keypointSelectionMap.forEach((selectedKeyIds, trackId) => {
      if (selectedKeyIds.size === 0) return;
      tracks.push(trackId);
      selectedKeyIds.forEach((keypointId) => {
        keys.push(keypointId);
      });
    });

    return { selectedTracks: tracks, selectedKeys: keys };
  }, [keypointSelectionMap]);

  const hasSelection = selectedKeys.length > 0;
  const trackColor = useColors(selectedTracks);

  return (
    <div
      className={clsx(
        "rounded-md flex responsive custom-color variant-responsive-persistent-outline gap-2",
        hasSelection ? "outline-2" : "outline-1",
      )}
      style={
        {
          "--custom-color": trackColor,
        } as CSSProperties
      }
    >
      <Dropdown
        side="top"
        trigger={
          <Button
            color={trackColor}
            visuals="inverted"
            size={Size.Sm}
            leftIcon={
              <IconArrowLeft className="h-3/5 aspect-square" fillOpacity={hasSelection ? 1 : 0} />
            }
          >
            Incoming
          </Button>
        }
      >
        <NestedLabel>
          {hasSelection ? "Incoming Transition" : "Default Incoming Transition"}
        </NestedLabel>
        <NestedRadio
          value={"bezier"}
          onChange={(t) => {}}
          options={[
            {
              value: StandardTransitionType.Sine,
              label: "Sinusoidal",
            },
            {
              value: StandardTransitionType.Cubic,
              label: "Cubic",
            },
            {
              value: StandardTransitionType.Quint,
              label: "Quintic",
            },
            {
              value: StandardTransitionType.Circ,
              label: "Circular",
            },
            {
              value: StandardTransitionType.Quad,
              label: "Quadratic",
            },
            {
              value: StandardTransitionType.Quart,
              label: "Quartic",
            },
            {
              value: StandardTransitionType.Expo,
              label: "Exponential",
            },
            {
              value: StandardTransitionType.Back,
              label: "Back",
            },
            {
              value: StandardTransitionType.Linear,
              label: "Linear",
            },
            {
              value: "bezier",
              label: "Bézier",
            },
          ]}
        />
      </Dropdown>
      <Dropdown
        side="top"
        trigger={
          <Button
            color={trackColor}
            visuals="inverted"
            size={Size.Sm}
            leftIcon={<IconVertexPaired className="h-3/5 aspect-square" />}
          />
        }
      >
        <NestedLabel>{hasSelection ? "Key Type" : "Default Key Type"}</NestedLabel>
        <NestedRadio
          value={TransitionPairing.Paired}
          onChange={(t) => {}}
          options={[
            {
              value: TransitionPairing.Paired,
              label: "Paired",
              icon: <IconVertexPaired className="h-3/4 aspect-square" />,
            },
            {
              value: TransitionPairing.Free,
              label: "Free",
              icon: <IconVertexFree className="h-3/4 aspect-square" />,
            },
          ]}
        />

        <NestedSeparator />
        <NestedLabel>{hasSelection ? "Transition Type" : "Default Transition Type"}</NestedLabel>
        <NestedRadio
          value={"bezier"}
          onChange={(t) => {}}
          options={[
            {
              value: StandardTransitionType.Sine,
              label: "Sinusoidal",
            },
            {
              value: StandardTransitionType.Cubic,
              label: "Cubic",
            },
            {
              value: StandardTransitionType.Quint,
              label: "Quintic",
            },
            {
              value: StandardTransitionType.Circ,
              label: "Circular",
            },
            {
              value: StandardTransitionType.Quad,
              label: "Quadratic",
            },
            {
              value: StandardTransitionType.Quart,
              label: "Quartic",
            },
            {
              value: StandardTransitionType.Expo,
              label: "Exponential",
            },
            {
              value: StandardTransitionType.Back,
              label: "Back",
            },
            {
              value: StandardTransitionType.Linear,
              label: "Linear",
            },
            {
              value: "bezier",
              label: "Bézier",
            },
          ]}
        />
      </Dropdown>
      <Dropdown
        side="top"
        trigger={
          <Button
            color={trackColor}
            visuals="inverted"
            size={Size.Sm}
            rightIcon={
              <IconArrowRight className="h-3/5 aspect-square" fillOpacity={hasSelection ? 1 : 0} />
            }
          >
            Outgoing
          </Button>
        }
      >
        <NestedLabel>
          {hasSelection ? "Outgoing Transition" : "Default Outgoing Transition"}
        </NestedLabel>
        <NestedRadio
          value={"bezier"}
          onChange={(t) => {}}
          options={[
            {
              value: StandardTransitionType.Sine,
              label: "Sinusoidal",
            },
            {
              value: StandardTransitionType.Cubic,
              label: "Cubic",
            },
            {
              value: StandardTransitionType.Quint,
              label: "Quintic",
            },
            {
              value: StandardTransitionType.Circ,
              label: "Circular",
            },
            {
              value: StandardTransitionType.Quad,
              label: "Quadratic",
            },
            {
              value: StandardTransitionType.Quart,
              label: "Quartic",
            },
            {
              value: StandardTransitionType.Expo,
              label: "Exponential",
            },
            {
              value: StandardTransitionType.Back,
              label: "Back",
            },
            {
              value: StandardTransitionType.Linear,
              label: "Linear",
            },
            {
              value: "bezier",
              label: "Bézier",
            },
          ]}
        />
      </Dropdown>
    </div>
  );
});
