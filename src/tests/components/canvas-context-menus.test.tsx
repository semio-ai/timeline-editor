// @vitest-environment jsdom
import { Component, type MouseEvent, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  TimeDisplay,
  TooltipHost,
  useCanvasContextMenu,
  useTooltipStore,
  type CanvasContextMenuContext,
} from "@semio/ui";
import { AnimationContext } from "../../context";
import type { AnimationStore } from "../../store";
import { createMinimalAnimationStore } from "../../test-fixtures";
import {
  buildKeyMenuItems,
  buildMinimapMenuItems,
  buildRulerMenuItems,
  buildTrackMenuItems,
} from "../../components/canvas-sheet/context-menus";

/**
 * Canvas context menu content renders under the outermost `TooltipHost`. An app
 * may mount that host above every animation provider (Studio mounts it at its
 * root), so these menus must work with no `AnimationContext` where they render.
 */

const CLICKED_STAMP = 1200;

const MENUS: {
  name: string;
  items: (ctx: CanvasContextMenuContext, store: AnimationStore) => ReactNode;
}[] = [
  { name: "track", items: (ctx, store) => buildTrackMenuItems(ctx, store) },
  { name: "key", items: (ctx, store) => buildKeyMenuItems(ctx, store) },
  {
    name: "ruler",
    items: (ctx, store) => buildRulerMenuItems(ctx, store, TimeDisplay.Seconds, () => {}),
  },
  { name: "minimap", items: (ctx, store) => buildMinimapMenuItems(ctx, store) },
];

class RecordErrors extends Component<
  { errors: Error[]; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.errors.push(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** A right-click target standing in for a canvas mesh: R3F would supply the raycast point. */
function CanvasTarget({
  store,
  items,
}: {
  store: AnimationStore;
  items: (ctx: CanvasContextMenuContext, store: AnimationStore) => ReactNode;
}) {
  const { onContextMenu } = useCanvasContextMenu({ items: (ctx) => items(ctx, store) });
  const onDomContextMenu = (event: MouseEvent) =>
    onContextMenu({
      nativeEvent: event.nativeEvent,
      point: { x: CLICKED_STAMP, y: 0, z: 0 },
    } as unknown as Parameters<typeof onContextMenu>[0]);
  return <div data-testid="canvas" onContextMenu={onDomContextMenu} />;
}

function renderOutsideProvider(menu: (typeof MENUS)[number]) {
  const store = createMinimalAnimationStore();
  const errors: Error[] = [];
  render(
    <RecordErrors errors={errors}>
      <TooltipHost>
        <AnimationContext.Provider value={store}>
          <TooltipHost>
            <CanvasTarget store={store} items={menu.items} />
          </TooltipHost>
        </AnimationContext.Provider>
      </TooltipHost>
    </RecordErrors>,
  );
  return { store, errors };
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("PointerEvent", globalThis.MouseEvent);
  Object.defineProperty(HTMLElement.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
  useTooltipStore.setState({ anchors: new Map(), visibility: new Map() });
});

describe("canvas context menus rendered outside the animation provider", () => {
  it.each(MENUS)("the $name menu opens and moves the playhead", async (menu) => {
    const { store, errors } = renderOutsideProvider(menu);

    fireEvent.contextMenu(screen.getByTestId("canvas"), { clientX: 40, clientY: 40 });
    const movePlayhead = await screen.findByText("Move Playhead");

    expect(errors).toEqual([]);
    // A menu runs the chosen action once it has finished closing.
    fireEvent.click(movePlayhead);
    await waitFor(() =>
      expect(store.getState().playerStore.getState().player.stamp).toBe(CLICKED_STAMP),
    );
    expect(errors).toEqual([]);
  });
});
