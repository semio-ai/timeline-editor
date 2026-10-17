import { memo, useCallback } from "react";
import {
  Dropdown,
  Icon,
  type IconValue,
  NestedLabel,
  NestedRadio,
  NestedSeparator,
  Size,
} from "@semio/ui";
import { useShallow } from "zustand/shallow";
import { TrackRender, VerticalAxis } from "../../types";
import { useAnimationStore } from "../../hooks";
import { ToolbarTooltipButton } from "./toolbar-tooltip-button";

export interface ViewToolbarSectionProps {
  viewId: string;
}

const TRACK_RENDER_OPTIONS: {
  value: TrackRender;
  label: string;
  icon: IconValue;
  disabled?: boolean;
}[] = [
  {
    value: TrackRender.Key,
    label: "Key View",
    icon: <Icon name="view-keys" />,
  },
  {
    value: TrackRender.Transition,
    label: "Transition View",
    icon: <Icon name="view-transitions" />,
  },
  {
    value: TrackRender.Preview,
    label: "Preview View",
    icon: <Icon name="view-preview" />,
  },
  {
    value: TrackRender.Spline,
    label: "Spline View",
    icon: <Icon name="view-spline" />,
  },
  {
    value: TrackRender.Data,
    label: "Data View (Coming Soon)",
    icon: <Icon name="view-data" />,
    disabled: true,
  },
];

export const ViewToolbarSection = memo(function ViewToolbarSection({
  viewId,
}: ViewToolbarSectionProps) {
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
    <div className="variant-scope variant-responsive-persistent-outline toolbar-segments flex gap-0.5 rounded-sm p-0.5">
      <Dropdown
        side="top"
        trigger={
          <ToolbarTooltipButton
            tooltip="Open view mode and Y-axis scaling settings"
            visuals="inverted"
            size={Size.Sm}
            leftIcon={activeTrackRenderOption.icon}
            rightIcon="select-indicator"
            altText={`View mode: ${activeTrackRenderOption.label}`}
            className="min-w-36 rounded-xs bg-neutral-500/10 hover:bg-neutral-500/25"
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
              icon: <Icon name="vertical-normalize" />,
              disabled: trackRender !== TrackRender.Spline,
            },
            {
              value: VerticalAxis.Uniform,
              label: "Uniform Y",
              icon: <Icon name="vertical-uniform" />,
              disabled: trackRender !== TrackRender.Spline,
            },
          ]}
        />
      </Dropdown>
    </div>
  );
});
