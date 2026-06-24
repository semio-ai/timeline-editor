import { ReactNode } from "react";
import { ICON_CLASS_NAME, IconKey, NestedItem, NestedLabel, KeybindingHint } from "@semio/ui";
import { AnimationAction } from "../../../keybindings";

/**
 * "Keys" section for the canvas (tracks-area) right-click menu: Add Key /
 * Remove Key at the clicked time. Targets and enablement are resolved by the
 * caller (spline → current selection; non-spline → the clicked row), since the
 * menu content renders in a Radix portal outside the animation context tree.
 */
export function KeyEditActionsSection({
  addEnabled,
  removeEnabled,
  onAddKey,
  onRemoveKey,
}: {
  addEnabled: boolean;
  removeEnabled: boolean;
  onAddKey: () => void;
  onRemoveKey: () => void;
}): ReactNode {
  return (
    <>
      <NestedLabel>Keys</NestedLabel>
      <NestedItem
        disabled={!addEnabled}
        onClick={onAddKey}
        left={<IconKey fillOpacity={0} center="plus" size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.AddKey} />}
      >
        Add Key
      </NestedItem>
      <NestedItem
        disabled={!removeEnabled}
        onClick={onRemoveKey}
        left={<IconKey fillOpacity={0} center="minus" size="18px" className={ICON_CLASS_NAME} />}
      >
        Remove Key
      </NestedItem>
    </>
  );
}
