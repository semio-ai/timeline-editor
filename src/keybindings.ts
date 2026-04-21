import type { KeybindingMap } from "@semio/ui";

/**
 * Action IDs for animation package keybindings.
 * All prefixed with "animation:" to avoid collisions with other packages.
 */
export const AnimationAction = {
  PlayPause: "animation:play-pause",
  SkipBack: "animation:skip-back",
  SkipForward: "animation:skip-forward",
  SetLeftBounds: "animation:set-left-bounds",
  SetRightBounds: "animation:set-right-bounds",
  Cut: "animation:cut",
  Copy: "animation:copy",
  Paste: "animation:paste",
  Delete: "animation:delete",
  SelectAll: "animation:select-all",
  DeselectAll: "animation:deselect-all",
  Undo: "animation:undo",
  Redo: "animation:redo",
} as const;

/**
 * Default keybinding definitions for the animation package.
 * Uses Mantine hotkey syntax for key combos.
 */
export const animationKeybindings: KeybindingMap = {
  [AnimationAction.PlayPause]: { keys: ["space"], label: "Play / Pause" },
  [AnimationAction.SkipBack]: { keys: ["ArrowLeft"], label: "Skip Back" },
  [AnimationAction.SkipForward]: { keys: ["ArrowRight"], label: "Skip Forward" },
  [AnimationAction.SetLeftBounds]: { keys: ["mod+["], label: "Set Left Bounds" },
  [AnimationAction.SetRightBounds]: { keys: ["mod+]"], label: "Set Right Bounds" },
  [AnimationAction.Cut]: { keys: ["mod+x"], label: "Cut" },
  [AnimationAction.Copy]: { keys: ["mod+c"], label: "Copy" },
  [AnimationAction.Paste]: { keys: ["mod+v"], label: "Paste" },
  [AnimationAction.Delete]: { keys: ["delete"], label: "Delete" },
  [AnimationAction.SelectAll]: { keys: ["mod+a"], label: "Select All" },
  [AnimationAction.DeselectAll]: { keys: ["mod+d"], label: "Deselect All" },
  [AnimationAction.Undo]: { keys: ["mod+z"], label: "Undo" },
  [AnimationAction.Redo]: { keys: ["mod+y"], label: "Redo" },
};
