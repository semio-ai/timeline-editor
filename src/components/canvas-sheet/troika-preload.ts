// Type-safe re-export of the small surface of `troika-three-text` we use.
// The package itself ships no types; we wrap with a manual signature here
// so consumers (preload-fonts.ts) get TS coverage.

// @ts-expect-error — untyped module
import { preloadFont as preloadFontUntyped } from "troika-three-text";

export interface PreloadFontOptions {
  font?: string;
  characters?: string;
  sdfGlyphSize?: number;
}

export const preloadFont: (
  options: PreloadFontOptions,
  callback?: () => void,
) => void = preloadFontUntyped;
