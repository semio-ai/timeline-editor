/**
 * Logical depth categories applied to individual SourceRowData entries.
 * Foreground rows are further split into selected vs unselected tracks so
 * renderers can place highlights above non-selected data, while background
 * rows always sit behind the active animation.
 */
export enum LayerBand {
  Background = "background",
  ForegroundUnselected = "foreground-unselected",
  ForegroundSelected = "foreground-selected",
}
