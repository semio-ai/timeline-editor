import { Button, Icon, type IconValue, KeyIcon, Tooltip } from "@semio/ui";
import { DEFAULT_COLOR } from "../../constants";

export type ControlStripCenterIcon = "key" | "plus";

export interface ControlStripProps {
  color?: string;
  /**
   * Disables every button in the strip — both navigation (prev/next) and
   * the authoring center button. Use for blanket states like "playing".
   */
  disabled?: boolean;
  /**
   * Disables only the center (authoring) button. Use when navigation
   * should remain available but mutations are blocked — e.g. all rows
   * are readonly or user-locked. Prev/next navigation is read-only and
   * stays enabled in that case.
   */
  authoringDisabled?: boolean;
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
  centerContent?: IconValue;
  centerIcon?: ControlStripCenterIcon;
  centerFilled?: boolean;
  centerDashed?: boolean;
  centerDeemphasize?: boolean;
  centerAltText?: string;
}

export function ControlStrip({
  color = "#737373",
  disabled = false,
  authoringDisabled = false,
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
  const centerDisabled = disabled || authoringDisabled || !onCenter;

  const defaultCenterContent =
    centerIcon === "plus" ? (
      <Icon name="add" size="none" className="size-[16px]" />
    ) : (
      <KeyIcon
        size="none"
        className="size-[16px]"
        dashed={centerDashed}
        fillOpacity={centerFilled ? 1 : 0}
      />
    );

  return (
    <>
      <Tooltip invert content="Previous Key" disabled={prevDisabled}>
        <Button
          size="fit"
          color={prevVisible ? color : DEFAULT_COLOR}
          disabled={prevDisabled}
          onClick={prevDisabled ? undefined : onPrev}
          onMouseEnter={prevDisabled ? undefined : onPrevEnter}
          onMouseLeave={prevDisabled ? undefined : onPrevLeave}
          leftIcon={<Icon name="playback-play" size="none" className="rotate-180 size-2.5" />}
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
          leftIcon={<Icon name="playback-play" size="none" className="size-2.5" />}
          visuals="inverted"
          className={nextVisible ? undefined : "opacity-20"}
        />
      </Tooltip>
    </>
  );
}

function getCenterTooltipText(centerDisabled: boolean, centerAltText?: string): string {
  return centerDisabled && centerAltText
    ? `${centerAltText} (Disabled)`
    : centerAltText || "Center Key";
}
