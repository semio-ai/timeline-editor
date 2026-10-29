// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { Canvas } from "@react-three/fiber";
import { createStore } from "zustand/vanilla";
import { CanvasFrameloop, setCanvasFrameloop } from "@semio/utils";
import { usePlayerStore } from "../player/player-store";
import { AnimationContext } from "../context";
import type { AnimationStore } from "../store";
import {
  MinimapCanvas,
  TimelineCanvas,
  TracksCanvas,
} from "../components/canvas-sheet/canvas-sheet";

vi.mock("@react-three/fiber", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@react-three/fiber")>()),
  Canvas: vi.fn(() => null),
}));

vi.mock("@semio/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@semio/ui")>()),
  TooltipHost: ({ children }: { children: React.ReactNode }) => children,
}));

afterEach(() => {
  cleanup();
  setCanvasFrameloop(CanvasFrameloop.Always);
  vi.clearAllMocks();
});

const canvases = [
  ["timeline", () => <TimelineCanvas viewId="test-view" />],
  ["tracks", () => <TracksCanvas viewId="test-view" />],
  [
    "minimap",
    // The minimap reads its bounds from the store's player.
    () => (
      <AnimationContext.Provider
        value={createStore(() => ({ playerStore: usePlayerStore })) as unknown as AnimationStore}
      >
        <MinimapCanvas />
      </AnimationContext.Provider>
    ),
  ],
] as const;

it.each(canvases)("renders the %s every frame by default", (_name, createCanvas) => {
  render(createCanvas());
  expect(vi.mocked(Canvas).mock.lastCall?.[0].frameloop).toBe(CanvasFrameloop.Always);
});

it.each(canvases)(
  "applies the host's setting to the %s on mount and when disabled",
  (_name, createCanvas) => {
    setCanvasFrameloop(CanvasFrameloop.Demand);
    render(createCanvas());
    expect(vi.mocked(Canvas).mock.lastCall?.[0].frameloop).toBe(CanvasFrameloop.Demand);

    act(() => setCanvasFrameloop(CanvasFrameloop.Always));
    expect(vi.mocked(Canvas).mock.lastCall?.[0].frameloop).toBe(CanvasFrameloop.Always);
  },
);
