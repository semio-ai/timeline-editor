/**
 * Logical depth categories applied to individual SourceRowData entries.
 * Foreground rows are further split into selected vs unselected tracks so
 * renderers can place highlights above non-selected data, while background
 * rows always sit behind the active animation.
 *
 * ForegroundLocked tracks belong to the active instance (keep their color)
 * but are non-interactive — rendered as vertical lines instead of hexagons.
 */
export enum LayerBand {
  Background = "background",
  ForegroundLocked = "foreground-locked",
  ForegroundUnselected = "foreground-unselected",
  ForegroundSelected = "foreground-selected",
}
