import { memo, type ReactNode, useCallback } from "react";
import {
  Dropdown,
  ICON_CLASS_NAME,
  IconGraphView,
  IconVectorAngled,
  IconVectorBezier,
  IconVectorBezierHandles,
  IconVectorFlat,
  IconVerticalNormalize,
  IconVerticalUniform,
  NestedLabel,
  NestedRadio,
  NestedSeparator,
  Size,
} from "@semio/ui";
import { useShallow } from "zustand/shallow";
import { IconSelector } from "@tabler/icons-react";
import { TrackRender, VerticalAxis } from "../../types";
import { useAnimationStore } from "../../hooks";
import { ToolbarTooltipButton } from "./toolbar-tooltip-button";

export interface ViewToolbarSectionProps {
  viewId: string;
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
    <div className="rounded-sm flex responsive variant-responsive-persistent-outline gap-0.5 p-0.5">
      <Dropdown
        side="top"
        trigger={
          <ToolbarTooltipButton
            tooltip="Open view mode and Y-axis scaling settings"
            visuals="inverted"
            size={Size.Sm}
            leftIcon={activeTrackRenderOption.icon}
            rightIcon={<IconSelector className={ICON_CLASS_NAME} />}
            altText={`View mode: ${activeTrackRenderOption.label}`}
            className="bg-neutral-500/10 hover:bg-neutral-500/25 rounded-xs min-w-36"
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
              icon: <IconVerticalUniform className={ICON_CLASS_NAME} />,
              disabled: trackRender !== TrackRender.Spline,
            },
          ]}
        />
      </Dropdown>
    </div>
  );
});
