/**
 * Three-way toggle semantics shared between row toggles (visible / muted /
 * locked), the per-row property strip, and the menu items in
 * `useControlMenu`.
 *
 *   - `true`: every entry in the aggregate is on
 *   - `false`: every entry in the aggregate is off
 *   - `"partial"`: mixed
 *
 * The "partial → on" rule below matches the convention in
 * `TrackFilterToggles`: clicking a mixed-state control should always converge
 * to the same "all-on" outcome, so users don't have to guess what a second
 * click will do.
 */
export type AggregateState = boolean | "partial";

export function computeAggregate<T>(data: T[], getValue: (d: T) => boolean): AggregateState {
  if (data.length === 0) return false;
  const allOn = data.every((d) => getValue(d));
  const noneOn = data.every((d) => !getValue(d));
  return allOn ? true : noneOn ? false : "partial";
}

export function nextToggleValue(current: AggregateState): boolean {
  if (current === "partial") return true;
  return !current;
}
