import { memo, type ReactNode, useCallback } from "react";
import {
  Dropdown,
  ICON_CLASS_NAME,
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
} from "@semio/ui";
import { useShallow } from "zustand/shallow";
import { IconChevronDown } from "@tabler/icons-react";
import { clsx } from "clsx";
import { TrackRender, VerticalAxis } from "../../types";
import { useAnimationStore } from "../../hooks";
import { ToolbarTooltipButton } from "./toolbar-tooltip-button";

export interface ToolbarLeftSectionProps {
  viewId: string;
  onToggleExpand?: (expanded: boolean) => void;
  expanded?: boolean;
}

const TRACK_RENDER_OPTIONS: {
  value: TrackRender;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
}[] = [
  {
    value: TrackRender.Key,
    label: "Key View",
    icon: <IconVectorFlat className={ICON_CLASS_NAME} />,
  },
  {
    value: TrackRender.Transition,
    label: "Transition View",
    icon: <IconVectorAngled className={ICON_CLASS_NAME} />,
  },
  {
    value: TrackRender.Preview,
    label: "Preview View",
    icon: <IconVectorBezier className={ICON_CLASS_NAME} />,
  },
  {
    value: TrackRender.Spline,
    label: "Spline View",
    icon: <IconVectorBezierHandles className={ICON_CLASS_NAME} />,
  },
  {
    value: TrackRender.Data,
    label: "Data View (Coming Soon)",
    icon: <IconGraphView className={ICON_CLASS_NAME} />,
    disabled: true,
  },
];

export const ToolbarLeftSection = memo(function ToolbarLeftSection({
  viewId,
  onToggleExpand,
  expanded,
}: ToolbarLeftSectionProps) {
  const views = useAnimationStore(useShallow((state) => state.editorViews));
  const updateView = useAnimationStore(useShallow((state) => state.updateView));

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

  const activeTrackRenderOption =
    TRACK_RENDER_OPTIONS.find((option) => option.value === trackRender) ?? TRACK_RENDER_OPTIONS[0];

  return (
    <div className="rounded-sm flex responsive variant-responsive-persistent-outline gap-0.5 p-0.5">
      <ToolbarTooltipButton
        tooltip="Toggle track list expansion"
        visuals="inverted"
        size={Size.Sm}
        onClick={() => onToggleExpand?.(!(expanded ?? false))}
        altText="Expand Tracks"
        leftIcon={
          <IconChevronDown
            className={clsx(
              expanded ? "rotate-0" : "rotate-180",
              "transition-transform ease-in-out duration-75",
              ICON_CLASS_NAME,
            )}
          />
        }
        className="bg-neutral-500/10 hover:bg-neutral-500/25 rounded-l-xs"
      />
      <Dropdown
        side="top"
        trigger={
          <ToolbarTooltipButton
            tooltip="Open view mode and Y-axis scaling settings"
            visuals="inverted"
            size={Size.Sm}
            leftIcon={activeTrackRenderOption.icon}
            altText={`View mode: ${activeTrackRenderOption.label}`}
            className="bg-neutral-500/10 hover:bg-neutral-500/25 rounded-r-xs min-w-36"
          >
            {activeTrackRenderOption.label}
          </ToolbarTooltipButton>
        }
      >
        <NestedLabel>View Mode</NestedLabel>
        <NestedRadio
          value={trackRender}
          onChange={(v) => {
            setTrackRender(v as TrackRender);
          }}
          options={TRACK_RENDER_OPTIONS}
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
              icon: <IconVerticalNormalize className={ICON_CLASS_NAME} />,
              disabled: trackRender !== TrackRender.Spline,
            },
            {
              value: VerticalAxis.Uniform,
              label: "Uniform Y",
              icon: <IconUniform className={ICON_CLASS_NAME} />,
              disabled: trackRender !== TrackRender.Spline,
            },
          ]}
        />
      </Dropdown>
    </div>
  );
});
