import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import type {
  LayoutConfig,
  LayoutContextValue,
  RegionBounds,
  LayoutChangeHandler,
  Dimensions2D,
} from "./types";
import { useResponsiveLayout, useFixedLayout } from "./use-layout";

// Create the layout context
const LayoutContext = createContext<LayoutContextValue | null>(null);

export interface LayoutProviderProps {
  children: ReactNode;
  config: LayoutConfig;
  onLayoutChange?: LayoutChangeHandler;
  containerSize?: Dimensions2D;
  responsive?: boolean;
}

/**
 * Layout provider that manages layout state and provides it to child components
 */
export function LayoutProvider({
  children,
  config,
  onLayoutChange,
  containerSize,
  responsive = true,
}: LayoutProviderProps): ReactNode {
  // Always call both hooks to follow rules of hooks
  // Only pass onLayoutChange to the hook that will actually be used
  const useResponsive = responsive || !containerSize;
  const responsiveLayoutResult = useResponsiveLayout(
    config,
    useResponsive ? onLayoutChange : undefined,
  );
  const fixedLayoutResult = useFixedLayout(
    config,
    containerSize || { width: 800, height: 600 },
    useResponsive ? undefined : onLayoutChange,
  );

  // Choose the appropriate result based on responsive flag and container size
  const layoutResult = useMemo(() => {
    if (!responsive && containerSize) {
      return fixedLayoutResult;
    } else {
      return responsiveLayoutResult;
    }
  }, [responsive, containerSize, responsiveLayoutResult, fixedLayoutResult]);

  const contextValue = useMemo<LayoutContextValue>(
    () => ({
      state: layoutResult.state,
      getRegion: layoutResult.getRegion,
      updateConfig: layoutResult.updateConfig,
      updateContainerSize: layoutResult.updateContainerSize,
    }),
    [layoutResult],
  );

  return <LayoutContext.Provider value={contextValue}>{children}</LayoutContext.Provider>;
}

/**
 * Hook to access the layout context
 */
export function useLayoutContext(): LayoutContextValue {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayoutContext must be used within a LayoutProvider");
  }
  return context;
}

/**
 * Hook to get a specific region's bounds
 */
export function useRegion(regionId: string): RegionBounds | undefined {
  const { getRegion } = useLayoutContext();
  return getRegion(regionId);
}

/**
 * Hook to get all regions
 */
export function useAllRegions(): Map<string, RegionBounds> {
  const { state } = useLayoutContext();
  return state.regions;
}

/**
 * Hook to get the current layout configuration
 */
export function useLayoutConfig(): LayoutConfig {
  const { state } = useLayoutContext();
  return state.config;
}

/**
 * Hook to get the container size
 */
export function useContainerSize(): Dimensions2D {
  const { state } = useLayoutContext();
  return state.containerSize;
}

/**
 * Hook to update the layout configuration
 */
export function useUpdateLayout(): (config: LayoutConfig) => void {
  const { updateConfig } = useLayoutContext();
  return updateConfig;
}

/**
 * Higher-order component that wraps a component with layout context
 */
export function withLayout<P extends object>(
  Component: React.ComponentType<P>,
  layoutConfig: LayoutConfig,
  options?: {
    onLayoutChange?: LayoutChangeHandler;
    containerSize?: Dimensions2D;
    responsive?: boolean;
  },
) {
  return function WrappedComponent(props: P) {
    return (
      <LayoutProvider
        config={layoutConfig}
        onLayoutChange={options?.onLayoutChange}
        containerSize={options?.containerSize}
        responsive={options?.responsive}
      >
        <Component {...props} />
      </LayoutProvider>
    );
  };
}

/**
 * Debug component that renders layout information (useful for development)
 */
export function LayoutDebug(): ReactNode {
  const { state } = useLayoutContext();

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        background: "rgba(0,0,0,0.8)",
        color: "white",
        padding: "8px",
        fontSize: "12px",
        fontFamily: "monospace",
        zIndex: 9999,
        maxWidth: "300px",
        maxHeight: "200px",
        overflow: "auto",
      }}
    >
      <div>Layout Type: {state.config.type}</div>
      <div>
        Container: {state.containerSize.width}x{state.containerSize.height}
      </div>
      <div>Regions: {state.regions.size}</div>
      {Array.from(state.regions.entries()).map(([id, bounds]) => (
        <div key={id} style={{ marginTop: "4px", fontSize: "10px" }}>
          <div>{id}:</div>
          <div>
            {" "}
            pos: ({bounds.position.x.toFixed(1)}, {bounds.position.y.toFixed(1)})
          </div>
          <div>
            {" "}
            size: {bounds.dimensions.width.toFixed(1)}x{bounds.dimensions.height.toFixed(1)}
          </div>
        </div>
      ))}
    </div>
  );
}
