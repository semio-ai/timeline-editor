import { ReactNode } from "react";
import { NestedSeparator, type CanvasContextMenuContext, TimeDisplay } from "@semio/ui";
import { AnimationActionsSection } from "./animation-actions";
import { SelectionActionsSection } from "./selection-actions";
import { EditActionsSection } from "./edit-actions";
import { AxisSettingsSection } from "./axis-settings";
import { ZoomActionsSection } from "./zoom-actions";

/** Context menu items for the tracks area and timeline. */
export function buildTrackMenuItems(ctx: CanvasContextMenuContext): ReactNode {
  return (
    <>
      <AnimationActionsSection ctx={ctx} />
      <NestedSeparator />
      <SelectionActionsSection />
      <NestedSeparator />
      <EditActionsSection ctx={ctx} />
    </>
  );
}

/** Context menu items for the ruler. */
export function buildRulerMenuItems(
  ctx: CanvasContextMenuContext,
  timeDisplay: TimeDisplay,
  setTimeDisplay: (v: TimeDisplay) => void,
): ReactNode {
  return (
    <>
      <AnimationActionsSection ctx={ctx} />
      <NestedSeparator />
      <AxisSettingsSection timeDisplay={timeDisplay} setTimeDisplay={setTimeDisplay} />
    </>
  );
}

/** Context menu items for the minimap. */
export function buildMinimapMenuItems(ctx: CanvasContextMenuContext): ReactNode {
  return (
    <>
      <AnimationActionsSection ctx={ctx} />
      <NestedSeparator />
      <ZoomActionsSection />
    </>
  );
}
