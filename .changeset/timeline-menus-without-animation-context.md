---
"@semio/timeline-editor": patch
---

The timeline's canvas context menus (track area, key, ruler and minimap) open when they render outside the animation provider. Their "Animation" section — Move Playhead, Move Left Bounds, Move Right Bounds — takes its player commands from the menu builder and reads no context. An app that mounts its outermost `TooltipHost` above its animation providers, as Studio does, therefore gets the menu instead of "Missing AnimationProvider in the tree".
