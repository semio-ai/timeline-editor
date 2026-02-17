import { memo, useCallback, useState } from "react";
import {
  Button,
  Dropdown,
  IconGraphView,
  IconUniform,
  IconVectorAngled,
  IconVectorBezier,
  IconVectorBezierHandles,
  IconVectorFlat,
  IconVerticalNormalize,
  NestedLabel,
  NestedRadio,
  NestedSeparator,
  Size,
  ToggleSquare,
} from "@semio/ui";
import { useShallow } from "zustand/shallow";
import { IconArrowUpRight, IconChevronDown, IconLayout2 } from "@tabler/icons-react";
import { clsx } from "clsx";
import { TrackRender, VerticalAxis } from "../types";
import { useAnimationStore } from "../hooks";
import { KeyToolbarSection } from "./key-toolbar-section";

export interface ToolbarProps {
  viewId: string;
  onToggleExpand?: (expanded: boolean) => void;
  expanded?: boolean;
}

export const Toolbar = memo(function Toolbar({ viewId, onToggleExpand, expanded }: ToolbarProps) {
  const views = useAnimationStore(useShallow((state) => state.editorViews));
  const updateView = useAnimationStore(useShallow((state) => state.updateView));

  // View properties
  const trackRender = views?.[viewId]?.trackRender || TrackRender.Key;
  const verticalAxis = views?.[viewId]?.verticalAxis || VerticalAxis.Normalized;

  const setTrackRender = useCallback(
    (renderOption: TrackRender) => {
      updateView(viewId, { trackRender: renderOption });
    },
    [viewId, updateView],
  );

  const setVerticalAxis = useCallback(
    (vAxis: VerticalAxis) => {
      updateView(viewId, { verticalAxis: vAxis });
    },
    [viewId, updateView],
  );

  const [popped, setPopped] = useState(false);

  return (
    <div className="flex flex-1 flex-row h-9 items-center justify-between px-2 col-span-2">
      <div className="flex gap-2">
        <ToggleSquare
          size={Size.Sm}
          value={expanded ?? false}
          onChange={(v) => onToggleExpand?.(v)}
          label="Expand Tracks"
        >
          <IconChevronDown
            className={clsx(
              expanded ? "rotate-0" : "rotate-180",
              "transition-transform ease-in-out duration-75",
              "h-3/5 aspect-square",
            )}
          />
        </ToggleSquare>
        <Dropdown
          side="top"
          trigger={
            <Button
              visuals="inverted"
              size={Size.Sm}
              leftIcon={<IconLayout2 className="h-3/5 aspect-square" />}
              // rightIcon={
              //   <IconChevronDown
              //     className={clsx(
              //       "rotate-0 group-data-[state=open]/trigger:rotate-180",
              //       "transition-transform ease-in-out duration-75",
              //       "h-3/5 aspect-square",
              //     )}
              //   />
              // }
            >
              View Settings
            </Button>
          }
        >
          <NestedLabel>View Mode</NestedLabel>
          <NestedRadio
            value={trackRender}
            onChange={(v) => {
              setTrackRender(v as TrackRender);
            }}
            options={[
              {
                value: TrackRender.Key,
                label: "Key View",
                icon: <IconVectorFlat className="h-3/4 aspect-square" />,
              },
              {
                value: TrackRender.Transition,
                label: "Transition View",
                icon: <IconVectorAngled className="h-3/4 aspect-square" />,
              },
              {
                value: TrackRender.Preview,
                label: "Preview View",
                icon: <IconVectorBezier className="h-3/4 aspect-square" />,
              },
              {
                value: TrackRender.Spline,
                label: "Spline View",
                icon: <IconVectorBezierHandles className="h-3/4 aspect-square" />,
              },
              {
                value: TrackRender.Data,
                label: "Data View (Coming Soon)",
                icon: <IconGraphView className="h-3/4 aspect-square" />,
                disabled: true,
              },
            ]}
          />
          <NestedSeparator />
          <NestedLabel>Y-Axis Scaling</NestedLabel>
          <NestedRadio
            value={verticalAxis}
            onChange={(t) => {
              setVerticalAxis(t as VerticalAxis);
            }}
            options={[
              {
                value: VerticalAxis.Normalized,
                label: "Normalized Y",
                icon: <IconVerticalNormalize className="h-3/4 aspect-square" />,
                disabled: trackRender !== TrackRender.Spline,
              },
              {
                value: VerticalAxis.Uniform,
                label: "Uniform Y",
                icon: <IconUniform className="h-3/4 aspect-square" />,
                disabled: trackRender !== TrackRender.Spline,
              },
            ]}
          />
        </Dropdown>
      </div>
      <div className="flex gap-2">
        <KeyToolbarSection />
      </div>
      <div>
        <ToggleSquare
          sizing="inner"
          size={Size.Sm}
          value={popped}
          onChange={(v) => {
            setPopped(v);
          }}
          label="Pop Out (Coming Soon)"
          disabled
        >
          <IconArrowUpRight size="h-3/4 aspect-square" />
        </ToggleSquare>
      </div>
    </div>
  );
});
