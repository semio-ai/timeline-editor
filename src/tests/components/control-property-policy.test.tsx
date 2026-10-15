// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AnimatableControl } from "../../components/animatable-control";
import { TrackPropertiesStrip } from "../../components/controls/track-properties-strip";
import type { TrackPropertiesStripProps } from "../../components/controls/track-properties-strip";

const { state } = vi.hoisted(() => ({ state: {
  preferences: { controlStripMode: "properties" },
  instancedTrackSources: { source: { id: "source", data: [{ trackId: "t", animatableId: "joint" }] } },
  animatables: { joint: { id: "joint", type: "number", name: "Joint" } },
  animations: {}, tracks: {}, readonlyAnimations: {},
} }));
vi.mock("../../hooks", () => ({
  useAnimationStore: (selector: (value: unknown) => unknown) => selector(state),
  useActiveAnimationId: () => null,
  useColors: () => "red",
  useEditableLabel: () => ({}),
  useRowBackground: () => "",
  useControlMenu: () => ({}),
}));
vi.mock("../../components/track-control", () => ({
  TrackControl: ({ propertyControls }: { propertyControls?: TrackPropertiesStripProps }) =>
    <button type="button" onClick={propertyControls?.onToggleMuted}>Mute driver candidates</button>,
}));
vi.mock("../../components/track-menu-context", () => ({ useTrackMenuState: () => ({}) }));
vi.mock("@semio/ui", async () => ({
  ...await vi.importActual<typeof import("@semio/ui")>("@semio/ui"),
  ToggleSquare: ({ label, onChange }: { label: string; onChange: () => void }) =>
    <button type="button" onClick={onChange}>{label}</button>,
}));
afterEach(cleanup);

it("forwards host aggregate actions when an animatable delegates to a track row", () => {
  const mute = vi.fn();
  render(<AnimatableControl animatableId="joint" sourceRowId="source" propertyControls={{ muted: "partial", onToggleMuted: mute }} />);
  fireEvent.click(screen.getByRole("button", { name: "Mute driver candidates" }));
  expect(mute).toHaveBeenCalledTimes(1);
});

it("labels a mixed mute as Mute All, matching the toggle action", () => {
  const mute = vi.fn();
  render(<TrackPropertiesStrip isGroup muted="partial" onToggleMuted={mute} />);
  fireEvent.click(screen.getByRole("button", { name: "Mute All" }));
  expect(mute).toHaveBeenCalledTimes(1);
});
