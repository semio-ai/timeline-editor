# Three.js Layout System

A flexible, configurable layout system for positioning 3D content in Three.js canvases using familiar CSS-like concepts.

## Overview

This layout system abstracts the complex coordinate calculations needed for positioning content in Three.js scenes. Instead of manually calculating positions based on container dimensions, you define layouts using familiar concepts like Grid and Flexbox, and the system handles the Three.js coordinate transformations automatically.

## Key Features

- **CSS-like Layout Models**: Grid, Flexbox, and Absolute positioning
- **Automatic Coordinate Conversion**: Handles CSS → Three.js coordinate system conversion
- **Responsive**: Automatically responds to canvas size changes
- **Type-safe**: Full TypeScript support with comprehensive type definitions
- **Component-based**: React components for easy integration
- **Configurable**: Flexible configuration system for different layout needs

## Core Concepts

### Regions

Regions are named areas within your layout where content can be placed. Each region has:
- **Position**: Where it's located in 3D space
- **Dimensions**: Width and height
- **Bounds**: Complete positioning information including center point

### Layout Types

#### Grid Layout
Similar to CSS Grid, define rows and columns with flexible sizing:

```typescript
const gridLayout: GridLayoutConfig = {
  type: LayoutType.Grid,
  rows: [
    createSize.px(32),  // Fixed height header
    createSize.fr(1),   // Flexible content area
    createSize.px(36),  // Fixed height footer
  ],
  columns: [
    createSize.px(200), // Fixed width sidebar
    createSize.fr(1),   // Flexible main area
  ],
  regions: [
    { id: "header", gridRow: "1 / 2", gridColumn: "1 / -1" },
    { id: "sidebar", gridRow: "2 / 3", gridColumn: "1 / 2" },
    { id: "main", gridRow: "2 / 3", gridColumn: "2 / 3" },
    { id: "footer", gridRow: "3 / 4", gridColumn: "1 / -1" },
  ],
};
```

#### Flex Layout
Similar to CSS Flexbox for linear arrangements:

```typescript
const flexLayout: FlexLayoutConfig = {
  type: LayoutType.Flex,
  direction: LayoutDirection.Row,
  justify: LayoutJustify.SpaceBetween,
  align: LayoutAlign.Center,
  regions: [
    { id: "left", flexGrow: 1 },
    { id: "center", flexGrow: 2 },
    { id: "right", flexGrow: 1 },
  ],
};
```

#### Absolute Layout
For precise positioning:

```typescript
const absoluteLayout: AbsoluteLayoutConfig = {
  type: LayoutType.Absolute,
  regions: [
    {
      id: "overlay",
      position: { x: 10, y: 10 },
      dimensions: { width: 200, height: 100 },
    },
  ],
};
```

## Basic Usage

### 1. Set up the Layout Provider

```tsx
import { Canvas } from "@react-three/fiber";
import { LayoutProvider, RegionBackground } from "./layout";

function MyScene() {
  const layout = {
    type: LayoutType.Grid,
    rows: [createSize.px(50), createSize.fr(1)],
    columns: [createSize.fr(1)],
    regions: [
      { id: "header", gridRow: "1 / 2", gridColumn: "1 / 2" },
      { id: "content", gridRow: "2 / 3", gridColumn: "1 / 2" },
    ],
  };

  return (
    <Canvas>
      <LayoutProvider config={layout}>
        <RegionBackground regionId="header" color="lightblue" />
        <RegionBackground regionId="content" color="lightgreen" />
      </LayoutProvider>
    </Canvas>
  );
}
```

### 2. Place Content in Regions

```tsx
import { Region, RegionContent } from "./layout";

function MyContent() {
  return (
    <>
      {/* Simple region positioning */}
      <Region regionId="header">
        <mesh>
          <boxGeometry args={[10, 10, 10]} />
          <meshBasicMaterial color="red" />
        </mesh>
      </Region>

      {/* Region with padding and content management */}
      <RegionContent regionId="content" padding={{ top: 10, left: 10 }}>
        <mesh>
          <sphereGeometry args={[5]} />
          <meshBasicMaterial color="blue" />
        </mesh>
      </RegionContent>
    </>
  );
}
```

### 3. Access Region Information

```tsx
import { useRegion, useRegionDimensions } from "./layout";

function MyComponent() {
  const headerBounds = useRegion("header");
  const contentDimensions = useRegionDimensions("content");

  // Use bounds for custom positioning logic
  if (headerBounds) {
    console.log("Header center:", headerBounds.center);
    console.log("Header size:", headerBounds.dimensions);
  }

  return null;
}
```

## Size Units

The system supports various size units:

```typescript
import { createSize } from "./layout";

// Pixels (fixed size)
createSize.px(100)

// Percentage of container
createSize.percent(50)

// Fraction of available space (like CSS fr)
createSize.fr(1)

// Auto-sizing
createSize.auto()

// Content-based sizing
createSize.minContent()
createSize.maxContent()
```

## Component Reference

### Core Components

- **`LayoutProvider`**: Provides layout context to child components
- **`Region`**: Basic region container that positions content
- **`RegionContent`**: Region container with padding support
- **`RegionBackground`**: Renders colored backgrounds for regions
- **`RegionBorder`**: Renders borders around regions
- **`RegionOverlay`**: Interactive overlay for regions

### Layout Hooks

- **`useLayout`**: Core layout hook with full configuration
- **`useResponsiveLayout`**: Auto-responds to canvas size changes
- **`useFixedLayout`**: Fixed container size, no auto-resizing
- **`useRegion`**: Get bounds for a specific region
- **`useLayoutContext`**: Access full layout context

### Utility Functions

- **`createSize`**: Helper for creating size objects
- **`calculatePositions`**: Calculate region positions from config
- **`cssToThreePosition`**: Convert CSS coordinates to Three.js coordinates

## Advanced Examples

### Custom Layout Configuration

```typescript
import { createDataVisualizationLayoutConfig } from "./data-visualization-layout-config";

// Create a custom data visualization with different heights
const customLayout = createCustomDataVisualizationLayoutConfig({
  topRuler: 40,
  timeline: 50,
  minimap: 30,
  bottomRuler: 40,
});
```

### Responsive Layouts

```tsx
function ResponsiveDataVisualization() {
  const [compact, setCompact] = useState(false);
  
  const layout = compact 
    ? createMinimalDataVisualizationLayoutConfig()
    : createDataVisualizationLayoutConfig();

  return (
    <Canvas>
      <LayoutProvider config={layout}>
        {/* Content automatically repositions when layout changes */}
        <MyDataVisualizationContent />
      </LayoutProvider>
    </Canvas>
  );
}
```

### Custom Region Components

```tsx
function CustomRegion({ regionId, children }) {
  const bounds = useRegion(regionId);
  
  if (!bounds) return null;

  return (
    <Region regionId={regionId}>
      {/* Custom background */}
      <mesh>
        <planeGeometry args={[bounds.dimensions.width, bounds.dimensions.height]} />
        <meshBasicMaterial color="purple" transparent opacity={0.1} />
      </mesh>
      
      {/* Content */}
      {children}
    </Region>
  );
}
```

## Migration from Hardcoded Layouts

### Before (Manual Calculation)

```tsx
function OldDataVisualizationCanvas() {
  const { size } = useThree();
  const topRulerHeight = 32;
  const topRulerY = size.height / 2 - topRulerHeight / 2;
  
  return (
    <mesh position={[0, topRulerY, 0]}>
      <planeGeometry args={[size.width, topRulerHeight]} />
      <meshBasicMaterial color="cyan" />
    </mesh>
  );
}
```

### After (Layout System)

```tsx
function NewDataVisualizationCanvas() {
  return (
    <LayoutProvider config={DEFAULT_DATA_VISUALIZATION_LAYOUT}>
      <RegionBackground 
        regionId={DATA_VISUALIZATION_REGIONS.TOP_RULER} 
        color="cyan" 
      />
    </LayoutProvider>
  );
}
```

## Debugging

Enable debug mode to visualize layout regions:

```tsx
import { LayoutDebug, RegionDebug } from "./layout";

function MyScene() {
  return (
    <LayoutProvider config={layout}>
      {/* Global layout debug info */}
      <LayoutDebug />
      
      {/* Per-region debug visualization */}
      <RegionDebug regionId="header" showBounds showCenter showLabel />
      
      <MyContent />
    </LayoutProvider>
  );
}
```

## Performance Considerations

- Layout calculations are memoized and only recalculate when configuration or container size changes
- Region lookups are optimized with Map-based storage
- Use `useFixedLayout` for static layouts to avoid unnecessary recalculations
- Large numbers of regions (>100) may impact performance; consider chunking or virtualization

## TypeScript Support

The system is fully typed with comprehensive interfaces:

```typescript
import type { 
  LayoutConfig, 
  RegionBounds, 
  GridLayoutConfig,
  LayoutChangeEvent 
} from "./layout";

function handleLayoutChange(event: LayoutChangeEvent) {
  console.log(`Region ${event.regionId} changed bounds`);
}

const layout: GridLayoutConfig = {
  // Full type checking and IntelliSense support
};
```
