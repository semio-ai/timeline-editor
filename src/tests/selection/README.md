# Selection Tests Documentation

## Overview

This directory contains all selection-related tests for the animation system. Tests are organized by functionality and use the complete store instance from `animation-store-factory.ts` to ensure realistic testing conditions.

## Test Structure

```
/tests/selection/
├── README.md                               # This file
├── basic-selection.test.ts                # Core selection operations
├── modifier-selection.test.ts             # Ctrl/Cmd and Shift key selections
├── global-track-selection.test.ts         # Global vs track marker interaction
├── click-marker-action.test.ts            # Click marker action with store
├── visual-selection.test.ts               # Visual selection state
└── timeline-track-selection-debug.test.ts # Debug and analysis tests
```

## Test Categories

### 1. Basic Selection (`basic-selection.test.ts`)
Tests fundamental selection operations:
- **Single Click Selection**: Basic marker selection, replacing existing selections
- **Clear Selection**: Clearing all selections using the store's `clearSelection()` method
- **Instance Switching**: Automatic switching between animation instances when clicking markers
- **Group Track Handling**: Selection behavior for vector3/euler tracks
- **Minimal Store Tests**: Tests with minimal configuration using `createMinimalAnimationStore()`

### 2. Modifier Key Selection (`modifier-selection.test.ts`)
Tests selection with keyboard modifiers:
- **Ctrl/Cmd Click**: Toggle selection (add/remove from selection)
- **Shift Click**: Range selection between reference and clicked marker
- **Combined Modifiers**: Shift+Ctrl/Cmd for extended range selection
- **Cross-track Selection**: Modifier behavior across different track types

### 3. Global vs Track Selection (`global-track-selection.test.ts`)
Tests interaction between global timeline and track markers:
- **Global Marker Selection**: Selecting related track markers via global timeline
- **Track to Global Selection**: Global marker selection when clicking track markers
- **Selection Unit Consistency**: Ensuring consistent selection units across views
- **Cross-Instance Selection**: Instance-specific selection behavior
- **Selectable vs Non-Selectable Points**: Filtering based on the selectable flag

### 4. Click Marker Action (`click-marker-action.test.ts`)
Tests the core click marker action implementation:
- **Click Action Fundamentals**: Basic action execution through the store
- **Selection State Integration**: Integration with selection state manager
- **Track Type Specific Behavior**: Handling different track types (number, vector3, euler)
- **Instance and Namespace Handling**: Cross-namespace selection behavior
- **Error Handling**: Edge cases and invalid input handling

### 5. Visual Selection (`visual-selection.test.ts`)
Tests visual selection state and appearance:
- Visual feedback when markers are selected
- Handling of selectable vs non-selectable points
- Mixed selection scenarios
- Checking if markers should appear selected based on shared data points

### 6. Timeline-Track Selection Debug (`timeline-track-selection-debug.test.ts`)
Debug tests for analyzing selection issues:
- Timeline vs track marker selection synchronization
- Selection unit computation analysis
- Multi-instance selection behavior
- Root cause analysis for selection bugs

## Test Data Structure

All tests use factory-provided test data:

### Namespaces
- `NAMESPACE_ALPHA`: Contains shared and exclusive animations
- `NAMESPACE_BETA`: Contains shared and exclusive animations

### Animation Instances
- `ALPHA_SHARED`: Shared animation in namespace alpha
- `ALPHA_EXCLUSIVE`: Exclusive animation in namespace alpha
- `BETA_SHARED`: Shared animation in namespace beta
- `BETA_EXCLUSIVE`: Exclusive animation in namespace beta

### Track Types
- **Shared Tracks**: `POSITION` (vector3), `SCALE` (number), `OPACITY` (number)
- **Namespace A Tracks**: `ROTATION` (euler), `WIDTH` (number), `HEIGHT` (number)
- **Namespace B Tracks**: `TRANSLATION` (vector3), `INTENSITY` (number), `BLUR` (number)

## Common Test Patterns

### Store Initialization
```typescript
let store: AnimationStore;

beforeEach(async () => {
  store = createTestAnimationStore({
    includeNamespaceA: true,
    includeNamespaceB: true,
    activeInstance: INSTANCE_IDS.ALPHA_SHARED,
  });

  // Initialize subscriptions and wait for computed data
  const cleanup = store.getState().initAnimationSubscriptions();
  await new Promise((resolve) => setTimeout(resolve, 10));

  return cleanup;
});
```

### Marker Selection Pattern
```typescript
// Find marker data
const markerData = state.computedRowData[rowId]?.virtualFrames.find(
  (f) => f.id === markerId
);

// Filter for selectable points
const selectablePoints = markerData?.points?.filter((p) => p.selectable) || [];

// Create marker path
const path = createMarkerPath(rowId, markerId);

// Perform selection
store.getState().clickMarker(selectablePoints, path, shiftKey, ctrlKey);
```

## Known Issues and Failed Tests

### Failed Test Categories and Their Implications

1. **Group Track Selection Failures**
   - **Issue**: Some group track markers (vector3, euler) are not found in computed data
   - **Implication**: The computed data structure may not include all expected markers, especially for complex track types
   - **Tests Affected**: Group track handling tests in basic-selection and modifier-selection

2. **Selection Unit Consistency Failures**
   - **Issue**: Global and track markers don't always create consistent selection units
   - **Implication**: The selection unit logic may not properly handle markers that share points across different views
   - **Tests Affected**: Global-track selection unit tests

3. **Range Selection Failures**
   - **Issue**: Shift-click range selection doesn't work correctly across different rows
   - **Implication**: Range selection logic needs to handle row boundaries properly
   - **Tests Affected**: Shift-click tests in modifier-selection

4. **Visual Selection State Failures**
   - **Issue**: Visual selection state doesn't always match expected behavior
   - **Implication**: The visual feedback system needs better synchronization with selection state
   - **Tests Affected**: Visual appearance tests in global-track-selection

## Unimplemented Features (Removed from Tests)

The following features are not implemented in the animation store and their tests have been removed:

1. **Select All** (`selectAll()`)
   - Would select all markers in the active animation instance
   - Tests were in basic-selection.test.ts but are now skipped

2. **Invert Selection** (`invertSelection()`)
   - Would invert the current selection within the active instance
   - Entire test file (invert-selection.test.ts) was removed

These features would need to be implemented in the animation store before their tests can be added back.

## Areas for Improvement

### 1. Store Implementation
- Add `selectAll()` method to select all markers in active instance
- Add `invertSelection()` method to invert current selection
- Improve `getSelectionUnit()` to handle cross-view marker relationships better

### 2. Computed Data Structure
- Ensure all track markers are properly included in computed data
- Improve handling of group tracks (vector3, euler)
- Better support for global marker aggregation

### 3. Selection Logic
- Fix range selection to work within row boundaries only
- Improve selection unit consistency between global and track views
- Better handling of selectable vs non-selectable points

### 4. Test Infrastructure
- Add more comprehensive mock data for edge cases
- Improve async initialization reliability
- Add performance tests for large selections

## Running Tests

```bash
# Run all selection tests
npm test selection/

# Run specific test file
npm test selection/basic-selection

# Run with coverage
npm test -- --coverage selection/

# Run in watch mode for development
npm test -- --watch selection/
```

## Test Metrics

- **Total Test Files**: 6 active test files
- **Total Tests**: ~42 active tests (12 skipped for unimplemented features)
- **Pass Rate**: ~74% (31 passing, 11 failing)
- **Key Issues**: Group track handling, selection unit consistency, range selection

## Contributing

When adding new selection tests:

1. Use the complete store factory (`createTestAnimationStore`)
2. Follow established patterns for store initialization
3. Always filter for selectable points when clicking markers
4. Clean up subscriptions in `beforeEach` teardown
5. Group related tests in descriptive `describe` blocks
6. Document any new edge cases or known issues

## Technical Details

### Marker Path Format
- Track markers: `namespaceId/instanceId/trackId#markerId`
- Global markers: `global#markerId`

### Selection State Structure
```typescript
interface SelectionState {
  paths: string[];              // Array of selected marker paths
  pathSet: Set<string>;         // Set for fast lookup
  referenceMarker: string | null; // Reference for range selection
}
```

### Click Marker Signature
```typescript
clickMarker(
  points: InstancedTrackSourcePoint[],
  markerPath: string,
  shiftKey: boolean,
  ctrlKey: boolean
): void
```

## Future Work

1. **Implement Missing Features**: Add selectAll and invertSelection to store
2. **Fix Failed Tests**: Address group track and selection unit issues
3. **Improve Test Coverage**: Add tests for edge cases and performance
4. **Documentation**: Add inline comments explaining complex test scenarios
5. **Refactor**: Consider splitting large test files into smaller, focused units