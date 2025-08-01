import type {
  Size,
  Position2D,
  Dimensions2D,
  RegionBounds,
  GridLayoutConfig,
  FlexLayoutConfig,
  AbsoluteLayoutConfig,
  SizeResolver,
  PositionCalculator,
} from "./types";
import { SizeUnit, LayoutDirection } from "./types";

/**
 * Resolves a Size object to a pixel value
 */
export const resolveSize: SizeResolver = (size, containerSize, totalFractions = 1) => {
  if (typeof size.value === "string") {
    switch (size.value) {
      case "auto":
        // For auto, we might need more context, but default to remaining space
        return containerSize;
      case "min-content":
        return 0; // Minimum required space
      case "max-content":
        return containerSize; // Maximum available space
      default:
        return 0;
    }
  }

  switch (size.unit) {
    case SizeUnit.Pixels:
      return size.value;
    case SizeUnit.Percent:
      return (size.value / 100) * containerSize;
    case SizeUnit.Fraction:
      return (size.value / totalFractions) * containerSize;
    case SizeUnit.Auto:
      return containerSize;
    case SizeUnit.MinContent:
      return 0;
    case SizeUnit.MaxContent:
      return containerSize;
    default:
      return size.value;
  }
};

/**
 * Calculates total fraction units in a size array
 */
export const calculateTotalFractions = (sizes: Size[]): number => {
  return sizes.reduce((total, size) => {
    if (size.unit === SizeUnit.Fraction && typeof size.value === "number") {
      return total + size.value;
    }
    return total;
  }, 0);
};

/**
 * Applies padding to container dimensions
 */
export const applyPadding = (
  containerSize: Dimensions2D,
  padding?: { top?: number; right?: number; bottom?: number; left?: number },
): { size: Dimensions2D; offset: Position2D } => {
  if (!padding) {
    return { size: containerSize, offset: { x: 0, y: 0 } };
  }

  const { top = 0, right = 0, bottom = 0, left = 0 } = padding;

  return {
    size: {
      width: Math.max(0, containerSize.width - left - right),
      height: Math.max(0, containerSize.height - top - bottom),
    },
    offset: {
      x: left,
      y: top,
    },
  };
};

/**
 * Converts CSS-style coordinates to Three.js coordinates
 * In CSS: Y increases downward, origin at top-left
 * In Three.js: Y increases upward, origin at center
 */
export const cssToThreePosition = (
  cssPosition: Position2D,
  cssDimensions: Dimensions2D,
  containerSize: Dimensions2D,
): Position2D => {
  return {
    // X: Convert from left edge to center-based
    x: cssPosition.x + cssDimensions.width / 2 - containerSize.width / 2,
    // Y: Flip and convert from top edge to center-based
    y: containerSize.height / 2 - (cssPosition.y + cssDimensions.height / 2),
  };
};

/**
 * Calculates grid layout positions
 */
export const calculateGridLayout = (
  config: GridLayoutConfig,
  containerSize: Dimensions2D,
): Map<string, RegionBounds> => {
  const { size: paddedSize, offset: paddingOffset } = applyPadding(containerSize, config.padding);
  const regions = new Map<string, RegionBounds>();

  // Calculate row heights
  const totalRowFractions = calculateTotalFractions(config.rows);
  let remainingHeight = paddedSize.height;
  const rowHeights: number[] = [];

  // First pass: calculate fixed sizes
  config.rows.forEach((rowSize) => {
    if (rowSize.unit !== SizeUnit.Fraction) {
      const height = resolveSize(rowSize, paddedSize.height);
      rowHeights.push(height);
      remainingHeight -= height;
    } else {
      rowHeights.push(0); // Placeholder for fraction
    }
  });

  // Second pass: distribute remaining space to fractions
  config.rows.forEach((rowSize, index) => {
    if (rowSize.unit === SizeUnit.Fraction) {
      rowHeights[index] = resolveSize(rowSize, remainingHeight, totalRowFractions);
    }
  });

  // Calculate column widths
  const totalColumnFractions = calculateTotalFractions(config.columns);
  let remainingWidth = paddedSize.width;
  const columnWidths: number[] = [];

  // First pass: calculate fixed sizes
  config.columns.forEach((colSize) => {
    if (colSize.unit !== SizeUnit.Fraction) {
      const width = resolveSize(colSize, paddedSize.width);
      columnWidths.push(width);
      remainingWidth -= width;
    } else {
      columnWidths.push(0); // Placeholder for fraction
    }
  });

  // Second pass: distribute remaining space to fractions
  config.columns.forEach((colSize, index) => {
    if (colSize.unit === SizeUnit.Fraction) {
      columnWidths[index] = resolveSize(colSize, remainingWidth, totalColumnFractions);
    }
  });

  // Calculate cumulative positions
  const rowPositions: number[] = [];
  let currentY = 0;
  rowHeights.forEach((height) => {
    rowPositions.push(currentY);
    currentY += height;
  });

  const columnPositions: number[] = [];
  let currentX = 0;
  columnWidths.forEach((width) => {
    columnPositions.push(currentX);
    currentX += width;
  });

  // Position regions
  config.regions.forEach((region) => {
    // Simple grid area parsing (e.g., "1 / 1 / 2 / 2" or just use indices)
    let rowStart = 0,
      rowEnd = 1,
      colStart = 0,
      colEnd = 1;

    if (region.gridArea) {
      // Parse grid-area shorthand: "row-start / column-start / row-end / column-end"
      const parts = region.gridArea.split("/").map((s) => parseInt(s.trim()) - 1); // Convert to 0-based
      if (parts.length >= 4) {
        [rowStart, colStart, rowEnd, colEnd] = parts;
      }
    } else {
      // Use gridRow and gridColumn if available
      if (region.gridRow) {
        const rowParts = region.gridRow.split("/").map((s) => parseInt(s.trim()) - 1);
        rowStart = rowParts[0] || 0;
        rowEnd = rowParts[1] || rowStart + 1;
      }
      if (region.gridColumn) {
        const colParts = region.gridColumn.split("/").map((s) => parseInt(s.trim()) - 1);
        colStart = colParts[0] || 0;
        colEnd = colParts[1] || colStart + 1;
      }
    }

    // Calculate position and dimensions
    const x = columnPositions[colStart] + paddingOffset.x;
    const y = rowPositions[rowStart] + paddingOffset.y;
    const width = columnPositions
      .slice(colStart, colEnd)
      .reduce((sum, _, i) => sum + columnWidths[colStart + i], 0);
    const height = rowPositions
      .slice(rowStart, rowEnd)
      .reduce((sum, _, i) => sum + rowHeights[rowStart + i], 0);

    const cssPosition = { x, y };
    const cssDimensions = { width, height };
    const threePosition = cssToThreePosition(cssPosition, cssDimensions, containerSize);

    regions.set(region.id, {
      position: threePosition,
      dimensions: cssDimensions,
      center: threePosition,
    });
  });

  return regions;
};

/**
 * Calculates flex layout positions
 */
export const calculateFlexLayout = (
  config: FlexLayoutConfig,
  containerSize: Dimensions2D,
): Map<string, RegionBounds> => {
  const { size: paddedSize, offset: paddingOffset } = applyPadding(containerSize, config.padding);
  const regions = new Map<string, RegionBounds>();

  const isRow = config.direction === LayoutDirection.Row;
  const mainAxisSize = isRow ? paddedSize.width : paddedSize.height;
  const crossAxisSize = isRow ? paddedSize.height : paddedSize.width;

  // For now, implement a basic flex layout
  // This is a simplified version - a full implementation would handle flex-grow, flex-shrink, etc.
  const regionCount = config.regions.length;
  let currentPosition = 0;

  config.regions.forEach((region, _index) => {
    // Simple equal distribution for now
    const mainSize = mainAxisSize / regionCount;
    const crossSize = crossAxisSize;

    const cssPosition = isRow
      ? { x: currentPosition + paddingOffset.x, y: paddingOffset.y }
      : { x: paddingOffset.x, y: currentPosition + paddingOffset.y };

    const cssDimensions = isRow
      ? { width: mainSize, height: crossSize }
      : { width: crossSize, height: mainSize };

    const threePosition = cssToThreePosition(cssPosition, cssDimensions, containerSize);

    regions.set(region.id, {
      position: threePosition,
      dimensions: cssDimensions,
      center: threePosition,
    });

    currentPosition += mainSize;
  });

  return regions;
};

/**
 * Calculates absolute layout positions
 */
export const calculateAbsoluteLayout = (
  config: AbsoluteLayoutConfig,
  containerSize: Dimensions2D,
): Map<string, RegionBounds> => {
  const regions = new Map<string, RegionBounds>();

  config.regions.forEach((region) => {
    const threePosition = cssToThreePosition(region.position, region.dimensions, containerSize);

    regions.set(region.id, {
      position: threePosition,
      dimensions: region.dimensions,
      center: threePosition,
    });
  });

  return regions;
};

/**
 * Main position calculator that delegates to specific layout types
 */
export const calculatePositions: PositionCalculator = (config, containerSize) => {
  switch (config.type) {
    case "grid":
      return calculateGridLayout(config as GridLayoutConfig, containerSize);
    case "flex":
      return calculateFlexLayout(config as FlexLayoutConfig, containerSize);
    case "absolute":
      return calculateAbsoluteLayout(config as AbsoluteLayoutConfig, containerSize);
    default:
      return new Map();
  }
};

/**
 * Creates a Size object with common presets
 */
export const createSize = {
  px: (value: number): Size => ({ value, unit: SizeUnit.Pixels }),
  percent: (value: number): Size => ({ value, unit: SizeUnit.Percent }),
  fr: (value: number): Size => ({ value, unit: SizeUnit.Fraction }),
  auto: (): Size => ({ value: "auto", unit: SizeUnit.Auto }),
  minContent: (): Size => ({ value: "min-content", unit: SizeUnit.MinContent }),
  maxContent: (): Size => ({ value: "max-content", unit: SizeUnit.MaxContent }),
};
