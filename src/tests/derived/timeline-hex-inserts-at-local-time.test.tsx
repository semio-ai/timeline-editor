// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { AnimationContext } from "../../context";
import { TimelineControl } from "../../components/timeline-control";
import { computeLocalStamp } from "../../functions";
import { createCorpusStore } from "./parity/edit-corpus";

const { strip } = vi.hoisted(() => ({
  strip: { onHexClick: undefined as undefined | (() => void) },
}));
vi.mock("../../components/key-strip", () => ({
  KeyStrip: ({ onHexClick }: { onHexClick?: () => void }) => {
    strip.onHexClick = onHexClick;
    return null;
  },
}));
afterEach(cleanup);

it("adds keys from the timeline's hex at each instance's local time", () => {
  const store = createCorpusStore();
  // Every instance at twice the speed from its own offset: no local time is
  // the world's.
  const namespaces = Object.fromEntries(
    Object.entries(store.getState().namespaces).map(([id, namespace], n) => [
      id,
      {
        ...namespace,
        animationInstances: Object.fromEntries(
          Object.entries(namespace.animationInstances).map(([instanceId, instance], i) => [
            instanceId,
            {
              ...instance,
              settings: { ...instance.settings, timescale: 2, offset: 250 + 100 * (n + i) },
            },
          ]),
        ),
      },
    ]),
  );
  store.setState({ namespaces });
  const viewId = Object.keys(store.getState().editorViews)[0];
  render(
    createElement(
      AnimationContext.Provider,
      { value: store },
      createElement(TimelineControl, { viewId }),
    ),
  );
  expect(strip.onHexClick).toBeDefined();
  // A playhead where no track has a key: the hex adds one to every track.
  const world = 312.5;
  store.getState().playerStore.getState().resetPlayer(world);
  const before = store.getState().tracks;
  strip.onHexClick!();
  const global = store.getState().instancedTrackSources.global;
  const added = global.data.filter(
    (datum) =>
      store.getState().tracks[datum.trackId].points.length > before[datum.trackId].points.length,
  );
  expect(added.length).toBeGreaterThan(0);
  added.forEach((datum) => {
    const { settings } =
      store.getState().namespaces[datum.namespaceId].animationInstances[datum.instanceId];
    const local = computeLocalStamp(world, settings.timescale, settings.offset);
    expect(
      store.getState().tracks[datum.trackId].points.some((p) => Math.abs(p.stamp - local) < 1e-6),
      datum.trackId,
    ).toBe(true);
  });
});
