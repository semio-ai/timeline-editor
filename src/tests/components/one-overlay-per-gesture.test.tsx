// @vitest-environment jsdom
import type { MouseEvent, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TooltipHost, useCanvasContextMenu, useTooltipStore } from "@semio/ui";
import { AnimationContext } from "../../context";
import { createMinimalAnimationStore } from "../../test-fixtures";
import { buildTrackMenuItems } from "../../components/canvas-sheet/context-menus";
import { EnsureTooltipHost } from "../../components/ensure-tooltip-host";

/**
 * The sheet mounts one `TooltipHost` per canvas, and every root host renders
 * every visible overlay. These tests stand three sibling hosts in for the three
 * canvases and check that one gesture yields one overlay on screen.
 */

const CANVAS_COUNT = 3;

/** A right-click target standing in for a canvas mesh: R3F would supply the raycast point. */
function MenuTarget() {
  const store = createMinimalAnimationStore();
  const { onContextMenu } = useCanvasContextMenu({
    items: (ctx) => buildTrackMenuItems(ctx, store),
  });
  const onDomContextMenu = (event: MouseEvent) =>
    onContextMenu({
      nativeEvent: event.nativeEvent,
      point: { x: 0, y: 0, z: 0 },
    } as unknown as Parameters<typeof onContextMenu>[0]);
  return (
    <AnimationContext.Provider value={store}>
      <div data-testid="menu-target" onContextMenu={onDomContextMenu} />
    </AnimationContext.Provider>
  );
}

/**
 * Opens a popover registered the way a violation segment's click anchor
 * registers it. `useTooltipAnchor` itself needs an R3F canvas, so this goes
 * through the store it writes to.
 */
function openViolationAnchor() {
  const id = "violation-row-segment";
  const store = useTooltipStore.getState();
  store.registerAnchor({
    id,
    ref: { current: null },
    content: <div>Violation detail</div>,
    positioning: { axis: "both", side: "top" },
    mode: "click",
    interactive: true,
    group: "violation-segment",
  });
  store.updateCursorPosition(id, { x: 40, y: 40 });
  store.showTooltip(id, `${id}-click`);
}

/** Three sibling canvas hosts; the target sits in the first, as a gesture lands on one canvas. */
function CanvasHosts({ target }: { target: ReactNode }) {
  return (
    <>
      {Array.from({ length: CANVAS_COUNT }, (_, i) => (
        <TooltipHost key={i}>{i === 0 ? target : null}</TooltipHost>
      ))}
    </>
  );
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
  useTooltipStore.setState({
    anchors: new Map(),
    visibility: new Map(),
    triggers: new Map(),
    cursorPositions: new Map(),
  });
});

async function openMenu() {
  fireEvent.contextMenu(screen.getByTestId("menu-target"), { clientX: 40, clientY: 40 });
  await screen.findAllByText("Move Playhead");
  return screen.getAllByText("Move Playhead").length;
}

async function openViolation() {
  act(openViolationAnchor);
  await screen.findAllByText("Violation detail");
  return screen.getAllByText("Violation detail").length;
}

describe("one gesture shows one overlay across the sheet's canvas hosts", () => {
  // Shows the setup can see duplicates, so the single-overlay cases below
  // are not passing for lack of a way to fail.
  it("sibling root hosts each render the menu", async () => {
    render(<CanvasHosts target={<MenuTarget />} />);
    expect(await openMenu()).toBe(CANVAS_COUNT);
  });

  it("renders one right-click menu when the sheet supplies the root host", async () => {
    render(
      <EnsureTooltipHost>
        <CanvasHosts target={<MenuTarget />} />
      </EnsureTooltipHost>,
    );
    expect(await openMenu()).toBe(1);
  });

  it("sibling root hosts each render the violation popover", async () => {
    render(<CanvasHosts target={null} />);
    expect(await openViolation()).toBe(CANVAS_COUNT);
  });

  it("renders one violation popover when the sheet supplies the root host", async () => {
    render(
      <EnsureTooltipHost>
        <CanvasHosts target={null} />
      </EnsureTooltipHost>,
    );
    expect(await openViolation()).toBe(1);
  });

  it("adds no second root under an app-level host", async () => {
    render(
      <TooltipHost>
        <EnsureTooltipHost>
          <CanvasHosts target={<MenuTarget />} />
        </EnsureTooltipHost>
      </TooltipHost>,
    );
    expect(await openMenu()).toBe(1);
    // A settled count: a second root would render its copy in the same commit.
    await waitFor(() => expect(screen.getAllByText("Move Playhead")).toHaveLength(1));
  });
});
