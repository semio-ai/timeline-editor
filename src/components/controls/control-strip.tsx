import { type ReactNode } from "react";
import { IconPlus } from "@tabler/icons-react";
import { Play } from "@solar-icons/react-perf/Bold";
import { Button, IconKey, Tooltip } from "@semio/ui";
import { DEFAULT_COLOR } from "../../constants";

export type ControlStripCenterIcon = "key" | "plus";

export interface ControlStripProps {
  color?: string;
  disabled?: boolean;
  prevEnabled?: boolean;
  nextEnabled?: boolean;
  prevVisible?: boolean;
  nextVisible?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onPrevEnter?: () => void;
  onPrevLeave?: () => void;
  onNextEnter?: () => void;
  onNextLeave?: () => void;
  onCenter?: () => void;
  onCenterEnter?: () => void;
  onCenterLeave?: () => void;
  centerContent?: ReactNode;
  centerIcon?: ControlStripCenterIcon;
  centerFilled?: boolean;
  centerDashed?: boolean;
  centerDeemphasize?: boolean;
  centerAltText?: string;
}

export function ControlStrip({
  color = "#737373",
  disabled = false,
  prevEnabled = false,
  nextEnabled = false,
  prevVisible = true,
  nextVisible = true,
  onPrev,
  onNext,
  onPrevEnter,
  onPrevLeave,
  onNextEnter,
  onNextLeave,
  onCenter,
  onCenterEnter,
  onCenterLeave,
  centerContent,
  centerIcon = "key",
  centerFilled = false,
  centerDashed = false,
  centerDeemphasize = false,
  centerAltText,
}: ControlStripProps) {
  const prevDisabled = disabled || !prevEnabled || !onPrev;
  const nextDisabled = disabled || !nextEnabled || !onNext;
  const centerDisabled = disabled || !onCenter;

  const defaultCenterContent =
    centerIcon === "plus" ? (
      <IconPlus size="18px" />
    ) : (
      <IconKey size="18px" dashed={centerDashed} fillOpacity={centerFilled ? 1 : 0} />
    );

  return (
    <div className="grid h-7 w-16 grid-cols-3 items-center justify-between">
      <Tooltip invert content="Previous Key" disabled={prevDisabled}>
        <Button
          size="fit"
          color={prevVisible ? color : DEFAULT_COLOR}
          disabled={prevDisabled}
          onClick={prevDisabled ? undefined : onPrev}
          onMouseEnter={prevDisabled ? undefined : onPrevEnter}
          onMouseLeave={prevDisabled ? undefined : onPrevLeave}
          leftIcon={<Play className="rotate-180" size="10px" />}
          visuals="inverted"
          className={prevVisible ? undefined : "opacity-20"}
        />
      </Tooltip>
      <Tooltip invert content={getCenterTooltipText(centerDisabled, centerAltText)}>
        <Button
          size="fit"
          color={color}
          altText={centerAltText}
          disabled={centerDisabled}
          deemphasize={centerDeemphasize}
          onClick={centerDisabled ? undefined : onCenter}
          onMouseEnter={centerDisabled ? undefined : onCenterEnter}
          onMouseLeave={centerDisabled ? undefined : onCenterLeave}
          leftIcon={centerContent ? centerContent : defaultCenterContent}
          visuals="inverted"
        />
      </Tooltip>
      <Tooltip invert content="Next Key" disabled={nextDisabled}>
        <Button
          size="fit"
          color={nextVisible ? color : DEFAULT_COLOR}
          disabled={nextDisabled}
          onClick={nextDisabled ? undefined : onNext}
          onMouseEnter={nextDisabled ? undefined : onNextEnter}
          onMouseLeave={nextDisabled ? undefined : onNextLeave}
          leftIcon={<Play size="10px" />}
          visuals="inverted"
          className={nextVisible ? undefined : "opacity-20"}
        />
      </Tooltip>
    </div>
  );
}

function getCenterTooltipText(centerDisabled: boolean, centerAltText?: string): string {
  return centerDisabled && centerAltText
    ? `${centerAltText} (Disabled)`
    : centerAltText || "Center Key";
}
