# Bezier curve visualization

The motion stories render cubic Bezier lines and fills in a Three.js canvas:

- `motion-cubic-bezier-line.stories.tsx`: basic, animated, interactive and styled lines.
- `motion-cubic-bezier-fill.stories.tsx`: filled curves, baseline placement and extension.
- `motion-cubic-bezier-combined.stories.tsx`: preview, transition, key and buffer modes,
  animated transitions and multiple tracks.

Run `npm run storybook` from the package root and open the `animation/` sidebar.
Motion values drive control points without rerendering the React tree each frame.
Use the interactive examples to inspect curve shape and verify that line and fill
stay aligned as their control points change.
