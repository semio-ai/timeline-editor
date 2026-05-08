import { memo, useCallback, useMemo } from "react";
import {
  Dropdown,
  ICON_CLASS_NAME,
  NestedItem,
  NestedLabel,
  NestedRadio,
  NestedSeparator,
  Size,
  TimeDisplay,
} from "@semio/ui";
import { useShallow } from "zustand/shallow";
import { IconArrowsHorizontal, IconClock, IconSelector } from "@tabler/icons-react";
import { usePlayerStore } from "@semio/utils";
import { useAnimationStore } from "../../hooks";
import { setViewport, useViewport, requestVerticalFit } from "../../viewport-state";
import type { AnimationData, AnimationActions } from "../../store-types";
import { SettingsPopover } from "./settings-popover";
import { ToolbarTooltipButton } from "./toolbar-tooltip-button";

const ZOOM_PRESETS = [
  { label: "25%", factor: 0.25 },
  { label: "50%", factor: 0.5 },
  { label: "75%", factor: 0.75 },
  { label: "100%", factor: 1 },
  { label: "150%", factor: 1.5 },
  { label: "200%", factor: 2 },
  { label: "400%", factor: 4 },
  { label: "800%", factor: 8 },
];

const TIME_DISPLAY_OPTIONS: { value: TimeDisplay; label: string }[] = [
  { value: TimeDisplay.Frames, label: "Frames" },
  { value: TimeDisplay.Seconds, label: "Seconds" },
  { value: TimeDisplay.SecondsPlusFrames, label: "Seconds + Frames" },
];

const TIME_DISPLAY_SHORT: Record<string, string> = {
  [TimeDisplay.Frames]: "Frames",
  [TimeDisplay.Seconds]: "Seconds",
  [TimeDisplay.SecondsPlusFrames]: "S + F",
  [TimeDisplay.Milliseconds]: "ms",
};

export const ViewportToolbarSection = memo(function ViewportToolbarSection() {
  const viewport = useViewport();
  const duration = usePlayerStore(useShallow((state) => state.player.duration));
  const timeDisplay = useAnimationStore(
    useShallow((state: AnimationData) => state.timeDisplay),
  );
  const setTimeDisplay = useAnimationStore(
    useShallow((state: AnimationActions) => state.setTimeDisplay),
  );

  const vpWidth = viewport[1] - viewport[0];
  const zoomPercent = duration > 0 ? Math.round((duration / vpWidth) * 100) : 100;

  const currentZoomLabel = useMemo(() => {
    const currentFactor = duration > 0 ? duration / vpWidth : 1;
    let closest = ZOOM_PRESETS[0];
    let closestDist = Math.abs(currentFactor - closest.factor);
    for (const preset of ZOOM_PRESETS) {
      const dist = Math.abs(currentFactor - preset.factor);
      if (dist < closestDist) {
        closest = preset;
        closestDist = dist;
      }
    }
    if (closestDist < closest.factor * 0.05) {
      return closest.label;
    }
    return `${zoomPercent.toString()}%`;
  }, [duration, vpWidth, zoomPercent]);

  const applyZoomPreset = useCallback(
    (factor: number) => {
      if (duration <= 0) return;
      const newWidth = duration / factor;
      const center = (viewport[0] + viewport[1]) / 2;
      setViewport(center - newWidth / 2, center + newWidth / 2);
    },
    [duration, viewport],
  );

  const handleFitToContent = useCallback(() => {
    // Match the fixed camera's viewport: [0, duration].
    // The camera frustum padding is applied by calculatePaddedFrustum,
    // keeping the fit consistent with the global HUD views.
    setViewport(0, Math.max(duration, 1000));
    // Reset vertical positioning (spline → camera Y; non-spline → scroll).
    requestVerticalFit();
  }, [duration]);

  return (
    <div className="responsive variant-responsive-persistent-outline hidden gap-0.5 rounded-sm p-0.5 @[600px]:flex">
      {/* Time display mode */}
      <Dropdown
        side="top"
        trigger={
          <ToolbarTooltipButton
            tooltip="Time display format"
            visuals="inverted"
            size={Size.Sm}
            leftIcon={<IconClock className={ICON_CLASS_NAME} />}
            rightIcon={<IconSelector className={ICON_CLASS_NAME} />}
            className="w-28 rounded-xs bg-neutral-500/10 text-xs hover:bg-neutral-500/25"
          >
            {TIME_DISPLAY_SHORT[timeDisplay]}
          </ToolbarTooltipButton>
        }
      >
        <NestedLabel>Time Display</NestedLabel>
        <NestedRadio
          value={timeDisplay}
          onChange={(v) => setTimeDisplay(v as TimeDisplay)}
          options={TIME_DISPLAY_OPTIONS}
        />
      </Dropdown>

      {/* Zoom level */}
      <Dropdown
        side="top"
        trigger={
          <ToolbarTooltipButton
            tooltip="Set zoom level"
            visuals="inverted"
            size={Size.Sm}
            rightIcon={<IconSelector className={ICON_CLASS_NAME} />}
            className="w-20 rounded-xs bg-neutral-500/10 font-mono text-xs hover:bg-neutral-500/25"
          >
            {currentZoomLabel}
          </ToolbarTooltipButton>
        }
      >
        <NestedLabel>Zoom Level</NestedLabel>
        {ZOOM_PRESETS.map((preset) => (
          <NestedItem
            key={preset.label}
            onClick={() => applyZoomPreset(preset.factor)}
          >
            {preset.label}
          </NestedItem>
        ))}
        <NestedSeparator />
        <NestedItem onClick={handleFitToContent}>Fit to Content</NestedItem>
      </Dropdown>

      {/* Fit to content */}
      <ToolbarTooltipButton
        tooltip="Fit viewport to content"
        visuals="inverted"
        size={Size.Sm}
        leftIcon={<IconArrowsHorizontal className={ICON_CLASS_NAME} />}
        className="rounded-xs bg-neutral-500/10 hover:bg-neutral-500/25"
        onClick={handleFitToContent}
      />

      {/* Settings */}
      <SettingsPopover />
    </div>
  );
});
