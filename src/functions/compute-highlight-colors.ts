import { Theme } from "@semio/ui";
import { formatHex, oklab, interpolate } from "culori";

export type ThemeMode = Theme.Dark | Theme.Light;

export interface AccentColorSet {
  [Theme.Dark]: string;
  [Theme.Light]: string;
}

/**
 * Computes highlight colors using OKLAB color mixing equivalent to CSS:
 * --light-color: color-mix(in oklab, var(--custom-color) 80%, white);
 * --dark-color: color-mix(in oklab, var(--custom-color) 80%, black);
 */
export function computeHighlightColors(baseColor: string) {
  // Convert base color to OKLAB color space
  const base = oklab(baseColor);
  const white = oklab("white");
  const black = oklab("black");

  if (!base || !white || !black) {
    console.warn(`Invalid color conversion for: ${baseColor}`);
    return {
      light: baseColor,
      dark: baseColor,
    };
  }

  // Mix with white (80% base color, 20% white) for light variant
  const lightInterpolator = interpolate([base, white], "oklab");
  const lightColor = lightInterpolator(0.2);

  // Mix with black (80% base color, 20% black) for dark variant
  const darkInterpolator = interpolate([base, black], "oklab");
  const darkColor = darkInterpolator(0.2);

  return {
    light: lightColor ? formatHex(lightColor) : baseColor,
    dark: darkColor ? formatHex(darkColor) : baseColor,
  };
}

/**
 * Gets the appropriate highlight color based on theme mode
 * In dark mode, use the light variant (lighter version of base)
 * In light mode, use the dark variant (darker version of base)
 */
export function getHighlightColor(baseColor: string, themeMode: ThemeMode): string {
  const colors = computeHighlightColors(baseColor);
  const result = themeMode === Theme.Dark ? colors.light : colors.dark;
  return result ?? baseColor;
}

/**
 * Computes the mix value between two colors, equivalent to the css function.
 * This uses the oklab color space for perceptual mixing.
 */
export function computeOklabMix(color1: string, color2: string, percent: number): string {
  const c1 = oklab(color1);
  const c2 = oklab(color2);

  if (!c1 || !c2) {
    console.warn(`Invalid color conversion for: ${color1} or ${color2}`);
    return color1; // Fallback to first color
  }

  const interpolator = interpolate([c1, c2], "oklab");
  const mixedColor = interpolator(percent);

  return mixedColor ? formatHex(mixedColor) : color1; // Fallback to first color
}

/**
 * Computes theme-aware opacity values for background elements
 * Light themes need lower opacity to achieve similar perceived prominence as dark themes
 */
export function getThemeAwareOpacity(baseOpacity: number, themeMode: ThemeMode): number {
  if (themeMode === Theme.Light) {
    // Reduce opacity in light mode to compensate for higher contrast against light backgrounds
    return baseOpacity * 0.6;
  }
  return baseOpacity;
}

/**
 * Computes background element properties (color + opacity) that maintain consistent
 * visual prominence across light and dark themes
 */
export function getBackgroundElementProps(
  baseColor: string,
  baseOpacity: number,
  themeMode: ThemeMode,
  useHighlight = true,
): { color: string; opacity: number } {
  // Get theme-appropriate color
  const color = useHighlight ? getHighlightColor(baseColor, themeMode) : baseColor;

  // Get theme-aware opacity
  const opacity = getThemeAwareOpacity(baseOpacity, themeMode);

  return { color, opacity };
}

/**
 * Computes emphasis-aware opacity that scales appropriately with theme
 */
export function getEmphasisOpacity(
  baseOpacity: number,
  emphasizedOpacity: number,
  isEmphasized: boolean,
  themeMode: ThemeMode,
): number {
  const targetOpacity = isEmphasized ? emphasizedOpacity : baseOpacity;
  return getThemeAwareOpacity(targetOpacity, themeMode);
}
