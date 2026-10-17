// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useControlMenu } from "../../hooks/use-control-menu";
import type { SourceRow } from "../../types";

const { setTracksMuted } = vi.hoisted(() => ({ setTracksMuted: vi.fn() }));
vi.mock("../../hooks/use-animation-store", () => ({
  useAnimationStore: (selector: (state: unknown) => unknown) => selector({
    selectionState: { keypoints: new Set() }, clipboard: null, setTracksMuted,
  }),
}));
vi.mock("../../hooks/use-player", async () => {
  const { usePlayerStore } = await import("@semio/utils");
  return { usePlayer: usePlayerStore };
});
vi.mock("../../hooks/use-active-animation-id", () => ({ useActiveAnimationId: () => null }));
vi.mock("../../hooks/use-key-control-state", () => ({ useKeyControlState: () => ({ keyState: "none" }) }));
vi.mock("../../components/track-menu-context", () => ({ useTrackMenuState: () => ({}) }));
vi.mock("@semio/ui", () => ({
  KeybindingProvider: ({ children }: { children: ReactNode }) => children,
  useKeybindingMap: () => ({}),
}));
vi.mock("../../components/canvas-sheet/context-menus", () => ({
  TrackControlMenuContent: ({ muted, onToggleMuted, propertiesDisabled }: { muted: boolean; onToggleMuted: () => void; propertiesDisabled?: boolean }) =>
    <button type="button" disabled={propertiesDisabled} onClick={onToggleMuted}>{muted ? "Unmute" : "Mute"}</button>,
}));
afterEach(cleanup);

it("uses host aggregate menu state and handlers for mixed tracked and trackless groups", () => {
  const mute = vi.fn();
  const { result } = renderHook(() => useControlMenu({
    sourceRow: { id: "group", data: [{ namespaceId: "n", instanceId: "i", trackId: "t", muted: true }] } as SourceRow,
    trackIds: ["t"], isGroup: true, allReadonly: true,
    propertyControls: { muted: "partial", disabled: false, onToggleMuted: mute },
  }));
  render(result.current.menuContent);
  fireEvent.click(screen.getByRole("button", { name: "Mute" }));
  expect(mute).toHaveBeenCalledTimes(1);
  expect(setTracksMuted).not.toHaveBeenCalled();
});
