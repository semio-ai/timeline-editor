// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TrackControl } from "../../components/track-control";
import { RowNoticeContext } from "../../components/controls/label-with-notice";
import type { SourceRow } from "../../types";

/**
 * A track row's name and what the host states beside it, in the timeline's
 * rows as in a controls list: everything else the row reads is stubbed.
 */

const { state } = vi.hoisted(() => ({
  state: {
    preferences: { controlStripMode: "keys" },
    animatables: {},
    emphasisRowId: null,
    selectionState: { reference: null },
    focusSelectionInstance: () => {},
    setEmphasis: () => {},
    selectTrack: () => {},
    toggleTrackInSelection: () => {},
    rangeSelectTracks: () => {},
    updateKeypoints: () => {},
    updateSource: () => {},
    editSource: () => false,
    canEditSource: () => false,
  },
}));
vi.mock("../../hooks", () => ({
  useAnimationStore: (selector: (value: unknown) => unknown) => selector(state),
  useColors: () => "#ff0000",
  useControlMenu: () => ({ menuContent: null, setMenuOpen: () => {}, keyState: "none" }),
  useEditableLabel: (value: string) => ({ value }),
  useLocalGlobalTransformLookup: () => () => undefined,
  useNames: () => "Lamp",
  useRowBackground: () => "transparent",
  useRowEditState: () => ({ isActiveDriverForOwningEntity: true, isFocusedEntity: true }),
}));
vi.mock("../../hooks/use-track-value-reader", () => ({ useTrackValueReader: () => () => undefined }));
vi.mock("../../hooks/use-player", async () => {
  const { usePlayerStore } = await import("../../player/player-store");
  return { usePlayer: usePlayerStore };
});
vi.mock("../../components/key-strip", () => ({ KeyStrip: () => null }));
vi.mock("../../components/animatable-editor", () => ({ AnimatableEditor: () => null }));
afterEach(cleanup);

const lampRow = {
  id: "e@target/i/t-lamp",
  data: [
    {
      namespaceId: "e@target",
      instanceId: "i",
      animationId: "a",
      trackId: "t-lamp",
      animatableId: "anim-lamp",
      type: "boolean",
      editable: true,
      selectable: true,
      layerBand: "foreground-selected",
    },
  ],
} as unknown as SourceRow;

it("shows, beside a track's name, what the host states for the input it animates", () => {
  render(
    <RowNoticeContext.Provider
      value={(namespaceId, animatableId) =>
        namespaceId === "e@target" && animatableId === "anim-lamp" ? (
          <span role="img" aria-label="Quori 7 does not declare this input." />
        ) : undefined
      }
    >
      <TrackControl sourceRow={lampRow} />
    </RowNoticeContext.Provider>,
  );
  expect(screen.getByRole("img", { name: "Quori 7 does not declare this input." })).toBeDefined();
  expect(screen.getByDisplayValue("Lamp")).toBeDefined();
});

it("shows nothing beside it when the host states nothing", () => {
  render(<TrackControl sourceRow={lampRow} />);
  expect(screen.queryByRole("img", { name: "Quori 7 does not declare this input." })).toBeNull();
});
