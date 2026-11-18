---
"@semio/timeline-editor": patch
---

`AnimationSheet` now wraps itself in a `TooltipHost` when no host exists above it. Without one, each of the sheet's canvas hosts was a root host and rendered every visible 3D overlay, so one right-click opened a stacked menu per canvas and a violation popover could render more than once. Apps that already mount a `TooltipHost` above the sheet are unaffected.
