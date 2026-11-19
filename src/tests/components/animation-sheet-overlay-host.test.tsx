// @vitest-environment jsdom
import { useContext, useEffect, type MouseEvent, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TooltipHost, TooltipProvider, useCanvasContextMenu, useTooltipStore } from "@semio/ui";
import { AnimationContext } from "../../context";
import { LocalGlobalTransformContext } from "../../hooks/use-local-global-transforms";
import { createMinimalAnimationStore } from "../../test-fixtures";
import { AnimationSheetCore } from "../../components/animation-sheet";

/**
 * Renders the real sheet with its three WebGL canvases replaced by what matters
 * here: each mounts its own `TooltipHost`, as the real canvases do. A right-click
 * target in the tracks canvas opens a menu whose content records the sheet
 * context it rendered under.
 */

const seen: { inSheet?: unknown; inOverlay?: unknown } = {};

// Reads the innermost of the sheet's providers, so a matching value shows the
// overlay rendered below all of them. Its default is a separate object from
// the provided one, so identity tells the two apart.
function ContextProbe({ where }: { where: "inSheet" | "inOverlay" }) {
  seen[where] = useContext(LocalGlobalTransformContext);
  return where === "inOverlay" ? <div>Overlay probe</div> : null;
}

const overlayItems = () => <ContextProbe where="inOverlay" />;

function MenuTarget() {
  const { onContextMenu } = useCanvasContextMenu({ items: overlayItems });
  const onDomContextMenu = (event: MouseEvent) =>
    onContextMenu({
      nativeEvent: event.nativeEvent,
      point: { x: 0, y: 0, z: 0 },
    } as unknown as Parameters<typeof onContextMenu>[0]);
  return (
    <>
      <ContextProbe where="inSheet" />
      <div data-testid="tracks-canvas" onContextMenu={onDomContextMenu} />
    </>
  );
}

function StubCanvas({ children, onReady }: { children?: ReactNode; onReady?: () => void }) {
  useEffect(() => onReady?.(), [onReady]);
  return <TooltipHost>{children}</TooltipHost>;
}

vi.mock("../../components/canvas-sheet/canvas-sheet", () => ({
  TimelineCanvas: ({ onReady }: { onReady?: () => void }) => <StubCanvas onReady={onReady} />,
  TracksCanvas: () => (
    <StubCanvas>
      <MenuTarget />
    </StubCanvas>
  ),
  MinimapCanvas: ({ onReady }: { onReady?: () => void }) => <StubCanvas onReady={onReady} />,
}));

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
  delete seen.inSheet;
  delete seen.inOverlay;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
  useTooltipStore.setState({ anchors: new Map(), visibility: new Map(), triggers: new Map() });
});

function renderSheet(outerHost: boolean) {
  const sheet = (
    <TooltipProvider>
      <AnimationContext.Provider value={createMinimalAnimationStore()}>
        <AnimationSheetCore />
      </AnimationContext.Provider>
    </TooltipProvider>
  );
  render(outerHost ? <TooltipHost>{sheet}</TooltipHost> : sheet);
}

async function rightClickTracks() {
  fireEvent.contextMenu(screen.getByTestId("tracks-canvas"), { clientX: 40, clientY: 40 });
  await screen.findAllByText("Overlay probe");
  return screen.getAllByText("Overlay probe").length;
}

describe("AnimationSheet's overlay host", () => {
  it("renders one menu per right-click with no host above the sheet", async () => {
    renderSheet(false);
    expect(await rightClickTracks()).toBe(1);
  });

  it("renders menu content inside the sheet's providers", async () => {
    renderSheet(false);
    await rightClickTracks();
    expect(seen.inSheet).toBeDefined();
    expect(seen.inOverlay).toBe(seen.inSheet);
  });

  it("renders one menu per right-click under an app-level host", async () => {
    renderSheet(true);
    expect(await rightClickTracks()).toBe(1);
  });
});
