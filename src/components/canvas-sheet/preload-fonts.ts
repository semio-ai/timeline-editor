// Drei's <Text> wraps troika-three-text's preloadFont in suspend-react with a
// cache key of `['troika-text', font, characters]`. To avoid suspending on
// first canvas mount (which causes the canvas's children to unmount and
// remount when fonts arrive), we preload each (font, characters) combination
// the canvas tree actually uses. The cache is shared with drei's <Text>, so
// once primed, drei's components resolve synchronously without suspending.
//
// Two character sets are used in the canvas tree today:
//   - Ruler tick labels: "0123456789:.-sfm" (with 'm' for ms display)
//   - Playhead cart time: "0123456789:.-sf"
// If a new TrackText caller introduces a different character set, add it here.

import { preloadFont } from "./troika-preload";

const CHARACTER_SETS = ["0123456789:.-sfm", "0123456789:.-sf"] as const;

function preloadOne(font: string, characters: string): Promise<void> {
  return new Promise((resolve) => {
    preloadFont({ font, characters }, () => resolve());
  });
}

/**
 * Preload all canvas-tree fonts. Returns a promise that resolves once each
 * (font, characters) combination is in the troika cache. Caller should hold
 * canvas mounts until the promise resolves to avoid the suspend-driven
 * unmount/remount cycle on first paint.
 */
export async function preloadAnimationFonts(fonts: {
  mono?: string;
  ui?: string;
}): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const url of [fonts.mono, fonts.ui]) {
    if (!url) continue;
    for (const characters of CHARACTER_SETS) {
      tasks.push(preloadOne(url, characters));
    }
  }
  await Promise.all(tasks);
}
