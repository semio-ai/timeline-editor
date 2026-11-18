---
"@semio/timeline-editor": patch
---

The animation sheet (`AnimationSheet` and `AnimationSheetCore`) now supplies a root `TooltipHost`, inside its own context providers, when no host exists above it. Without one, each of the sheet's canvas hosts was a root host and rendered every visible 3D overlay, so one right-click opened a stacked menu per canvas and a violation popover could render more than once. Every root host on a page still renders every overlay, so two hostless sheets on one page need a shared host above them. Apps that already mount a `TooltipHost` above the sheet are unaffected.
