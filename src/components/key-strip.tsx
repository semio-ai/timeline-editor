import { useState } from "react";
import { IconKey } from "@semio/ui";
import { useKeyControlState } from "../hooks";
import { SourceRow } from "../types";
import { ControlStrip } from "./controls";

export interface KeyStripProps {
  color?: string;
  onHexClick?: () => void;
  source: SourceRow;
  /**
   * Blanket-disable every button in the strip. Use for states where even
   * navigation should be off (e.g. `playing`).
   */
  disabled?: boolean;
  /**
   * Disable only the center hex (add/remove key) — prev/next navigation
   * remains usable. Pass `true` when the row's tracks are non-editable
   * (readonly or user-locked) so viewers can still scrub between
   * keypoints to inspect them but can't author edits.
   */
  authoringDisabled?: boolean;
}

export function KeyStrip({
  color = "#737373",
  onHexClick,
  source,
  disabled,
  authoringDisabled,
}: KeyStripProps) {
  const {
    prevEnabled,
    nextEnabled,
    dashed,
    keyState,
    onPrev,
    onNext,
    onPrevPreviewEnter,
    onPrevPreviewLeave,
    onNextPreviewEnter,
    onNextPreviewLeave,
    trackIds,
  } = useKeyControlState(source);

  const [hovered, setHovered] = useState(false);

  const center = getCenter(hovered, keyState);
  const fillOpacity = getFillOpacity(hovered, keyState);
  const keyDashed = keyState === "none" ? dashed : false;

  return (
    <ControlStrip
      color={color}
      disabled={disabled}
      authoringDisabled={authoringDisabled}
      prevEnabled={prevEnabled}
      nextEnabled={nextEnabled}
      onPrev={onPrev}
      onNext={onNext}
      onPrevEnter={onPrevPreviewEnter}
      onPrevLeave={onPrevPreviewLeave}
      onNextEnter={onNextPreviewEnter}
      onNextLeave={onNextPreviewLeave}
      onCenter={onHexClick}
      onCenterEnter={() => setHovered(true)}
      onCenterLeave={() => setHovered(false)}
      centerDeemphasize={trackIds.length === 0}
      centerContent={
        <IconKey size="18px" fillOpacity={fillOpacity} dashed={keyDashed} center={center} />
      }
      centerAltText={keyState !== "full" ? "Add Key" : "Remove Key"}
    />
  );
}

function getCenter(
  hovered: boolean,
  keyState: "none" | "partial" | "full",
): "plus" | "minus" | undefined {
  if (!hovered) return undefined;
  if (keyState === "full") return "minus";
  return "plus";
}

function getFillOpacity(hovered: boolean, keyState: "none" | "partial" | "full"): number {
  if (keyState === "partial") return 0.5;
  if (hovered) return 0.5;
  if (keyState === "full") return 1;
  return 0;
}
