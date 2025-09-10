# Multi-Select Fix for Drag Operations

## Problem Description

Multi-select functionality was broken after implementing the drag system. The issues were:

1. **Lost Selection on Drag**: When dragging an unselected point, the entire selection was replaced instead of respecting modifier keys
2. **Click-Drag Conflict**: Click events were firing after drag operations, causing unwanted selection changes
3. **Modifier Keys Ignored**: Ctrl/Cmd and Shift keys weren't being considered during drag initiation

## Root Causes

### 1. Missing Modifier Key Handling in Drag Start

The original implementation always cleared selection when dragging an unselected point:

```tsx
// Before (incorrect)
onDragStart: ({ event }) => {
  if (!isSelected) {
    clickMarker(data, sources, allData, false, false); // Always replaces selection
  }
}
```

This ignored the user's intent when holding modifier keys for multi-select.

### 2. Click Event Firing After Drag

The useGesture library fires both drag and click events, causing:
- User drags a marker
- Drag completes successfully
- Click event fires immediately after
- Selection gets modified unexpectedly

### 3. Platform-Specific Modifier Keys

Different platforms use different modifier keys for multi-select:
- macOS: Cmd key (metaKey)
- Windows/Linux: Ctrl key (ctrlKey)

The code wasn't handling both cases properly.

## Solutions Implemented

### 1. Proper Modifier Key Handling

Updated drag start to respect modifier keys:

```tsx
// After (correct)
onDragStart: ({ event, shiftKey, metaKey, ctrlKey }) => {
  if (!isSelected) {
    // Use metaKey on Mac, ctrlKey on Windows/Linux for multi-select
    const modKey = metaKey || ctrlKey;
    
    // If no modifiers, replace selection. If modifiers, add to selection.
    clickMarker(data, sources, allData, shiftKey, modKey);
  }
}
```

### 2. Prevent Click After Drag

Added tracking to prevent click events after drag operations:

```tsx
const dragOccurredRef = useRef<boolean>(false);

// In onClick handler
onClick: ({ shiftKey, metaKey, event }) => {
  // Don't process click if it was preceded by a drag
  if (dragOccurredRef.current) {
    dragOccurredRef.current = false;
    return;
  }
  clickMarker(data, sources, allData, shiftKey, metaKey);
}

// In onDrag handler
onDrag: ({ movement: [mx], shiftKey, event }) => {
  // Mark that a drag has occurred
  dragOccurredRef.current = true;
  // ... rest of drag logic
}
```

### 3. Unified Selection Behavior

The selection now behaves consistently across all operations:
- **Click without modifiers**: Replace selection
- **Ctrl/Cmd + Click**: Toggle selection
- **Shift + Click**: Range selection
- **Drag without modifiers on unselected**: Replace selection with dragged item
- **Ctrl/Cmd + Drag on unselected**: Add to selection and drag all
- **Drag on selected item**: Drag entire selection

## How Multi-Select Works Now

### Selection Scenarios

#### 1. Single Selection Drag
- User has one marker selected
- Drags it to new position
- Only