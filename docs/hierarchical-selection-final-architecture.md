# Hierarchical Selection Architecture - Final Design

## Core Principles

### Two Entity Types Only

1. **Groups**: Organizational containers that can contain other groups or tracks (no keypoint data)
2. **Tracks**: Leaf nodes containing keypoint data of simple types (number, string, boolean)

### No Complex Datatype Tracks

In the future system, complex datatypes (vector3, euler, rgb, etc.) are NOT tracks - they are **groups** containing simple tracks:

```
position         # Group (not a "vector3 track")
position/x       # Track (number)
position/y       # Track (number)
position/z       # Track (number)
```

## Current System vs Future System

### Current System (Temporary)
```
namespace-1/instance-1/position       # Complex datatype (acts like group)
namespace-1/instance-1/position/x     # Attribute field (acts like track)
namespace-1/instance-1/position/y     # Attribute field (acts like track)
namespace-1/instance-1/position/z     # Attribute field (acts like track)

namespace-1/instance-1/scale          # Simple track (number)
namespace-1/instance-1/enabled        # Simple track (boolean)
```

### Future System (Clean Hierarchy)
```
namespace-1/instance-1/character                        # Group
namespace-1/instance-1/character/upper-body            # Group
namespace-1/instance-1/character/upper-body/arm        # Group
namespace-1/instance-1/character/upper-body/arm/position       # Group
namespace-1/instance-1/character/upper-body/arm/position/x     # Track (number)
namespace-1/instance-1/character/upper-body/arm/position/y     # Track (number)
namespace-1/instance-1/character/upper-body/arm/position/z     # Track (number)
namespace-1/instance-1/character/upper-body/arm/rotation       # Group
namespace-1/instance-1/character/upper-body/arm/rotation/r     # Track (number)
namespace-1/instance-1/character/upper-body/arm/rotation/p     # Track (number)
namespace-1/instance-1/character/upper-body/arm/rotation/y     # Track (number)
namespace-1/instance-1/character/upper-body/torso/scale        # Group
namespace-1/instance-1/character/upper-body/torso/scale/x      # Track (number)
namespace-1/instance-1/character/upper-body/torso/scale/y      # Track (number)
namespace-1/instance-1/character/upper-body/torso/scale/z      # Track (number)
namespace-1/instance-1/character/visibility                    # Track (boolean)
```

## Entity Classification Rules

### How to Identify Entity Type

```typescript
function classifyEntity(state: AnimationData, path: string): EntityType {
  const hasChildren = getDirectChildren(state, path).length > 0;
  
  if (hasChildren) {
    return EntityType.Group;  // Has children = always a group
  } else {
    return EntityType.Track;  // No children = always a track
  }
}
```

It's that simple! No special cases needed.

### Current System Compatibility

During transition, we need to handle the current system's quirks:

```typescript
function classifyEntityTransitional(state: AnimationData, path: string): EntityType {
  const depth = path.split('/').length;
  
  // Current system: depth 4 are "attributes" (will become tracks)
  if (depth === 4) {
    return EntityType.Track; // Treat current attributes as tracks
  }
  
  // Otherwise use the simple rule
  const hasChildren = getDirectChildren(state, path).length > 0;
  return hasChildren ? EntityType.Group : EntityType.Track;
}
```

## Selection Behavior

### Groups
When selecting a group, select:
1. The group itself (for visual feedback)
2. All descendant tracks (the actual data)

```typescript
function selectGroup(state: AnimationData, groupPath: string): string[] {
  const selection = [groupPath]; // Include group
  const tracks = getAllDescendantTracks(state, groupPath);
  return [...selection, ...tracks];
}
```

### Tracks
When selecting a track, determine if it should select with siblings:

```typescript
function selectTrack(state: AnimationData, trackPath: string): string[] {
  const parent = getParentPath(trackPath);
  
  // Check if parent is a "component group" (position, rotation, color, etc.)
  if (parent && isComponentGroup(state, parent)) {
    // Select all sibling tracks and parent group
    return selectGroup(state, parent);
  }
  
  // Otherwise just select the track
  return [trackPath];
}
```

### Component Groups

Component groups are groups representing logical units that should be selected together:

```typescript
function isComponentGroup(state: AnimationData, groupPath: string): boolean {
  // Check metadata first (future)
  const metadata = state.instancedTrackSources[groupPath]?.metadata;
  if (metadata?.componentGroup !== undefined) {
    return metadata.componentGroup;
  }
  
  // Infer from children names (transitional)
  const children = getDirectChildren(state, groupPath);
  const childNames = children.map(c => c.split('/').pop());
  
  // Known component patterns
  const componentPatterns = [
    ['x', 'y', 'z'],        // position, scale
    ['x', 'y'],             // vector2
    ['r', 'p', 'y'],        // rotation (euler)
    ['r', 'g', 'b'],        // color (rgb)
    ['h', 's', 'l'],        // color (hsl)
    ['w', 'x', 'y', 'z'],   // quaternion
  ];
  
  return componentPatterns.some(pattern => 
    pattern.every(name => childNames.includes(name))
  );
}
```

## Selection Rules by Interaction

### Click (No Modifiers)
```typescript
function handleClick(state: AnimationData, path: string): string[] {
  const entityType = classifyEntity(state, path);
  
  if (entityType === EntityType.Group) {
    return selectGroup(state, path);
  } else {
    return selectTrack(state, path);
  }
}
```

### Ctrl/Cmd-Click (Toggle)
```typescript
function handleCtrlClick(state: AnimationData, path: string): string[] {
  const selectionUnit = handleClick(state, path);
  const isAnySelected = selectionUnit.some(p => 
    state.selection.includes(p)
  );
  
  if (isAnySelected) {
    // Remove entire unit
    return state.selection.filter(s => !selectionUnit.includes(s));
  } else {
    // Add entire unit
    return [...state.selection, ...selectionUnit];
  }
}
```

### Shift-Click (Range)
```typescript
function handleShiftClick(
  state: AnimationData, 
  fromPath: string, 
  toPath: string
): string[] {
  // Must be siblings of same type
  if (!areSiblings(fromPath, toPath)) {
    return handleClick(state, toPath);
  }
  
  const siblings = getSiblings(state, fromPath);
  const fromIdx = siblings.indexOf(fromPath);
  const toIdx = siblings.indexOf(toPath);
  const [start, end] = [Math.min(fromIdx, toIdx), Math.max(fromIdx, toIdx)];
  
  const selection = new Set<string>();
  for (let i = start; i <= end; i++) {
    const unit = handleClick(state, siblings[i]);
    unit.forEach(p => selection.add(p));
  }
  
  return Array.from(selection);
}
```

## Migration Strategy

### Phase 1: Current System (Attributes as Special Case)
```
position       # Complex datatype (pseudo-group)
position/x     # Attribute (pseudo-track)
```
- Depth 4 paths are treated as tracks
- Depth 3 paths with children are treated as groups
- Selection of attributes includes siblings and parent

### Phase 2: Transitional (Both Patterns Supported)
```
// Old pattern still works
position/x     # Attribute at depth 4

// New pattern also works
character/arm/position/x   # Track at any depth
```
- Entity type determined by presence of children
- Component groups auto-detected by child names
- Metadata can override auto-detection

### Phase 3: Future System (Clean Hierarchy)
```
character/arm/position     # Group
character/arm/position/x   # Track
```
- Simple rule: has children = group, no children = track
- Component groups marked via metadata
- No special cases needed

## Implementation for Current Issues

### Issue 1: Group First Click Not Selecting Children
```typescript
// Fixed by always getting all descendant tracks
function selectGroup(state: AnimationData, groupPath: string): string[] {
  const tracks = getAllDescendantTracks(state, groupPath);
  return [groupPath, ...tracks]; // Always returns complete selection
}
```

### Issue 2: Shift-Click Within Group Loses Children
```typescript
// Fixed by preserving group selection logic in ranges
function createRange(state: AnimationData, from: string, to: string): string[] {
  const selection = new Set<string>();
  
  // Get all paths in range
  const rangePaths = getPathsInRange(state, from, to);
  
  // For each path, add its complete selection unit
  rangePaths.forEach(path => {
    const unit = handleClick(state, path);
    unit.forEach(p => selection.add(p));
  });
  
  return Array.from(selection);
}
```

### Issue 3: Ctrl-Click Cross-Track Deselection
```typescript
// Fixed by operating on selection units, not individual paths
function toggleSelection(state: AnimationData, path: string): string[] {
  const unit = getSelectionUnit(state, path);
  
  // Check if ANY part of unit is selected
  const isUnitSelected = unit.some(p => state.selection.includes(p));
  
  if (isUnitSelected) {
    // Remove entire unit, keep everything else
    return state.selection.filter(s => !unit.includes(s));
  } else {
    // Add entire unit to existing selection
    return [...state.selection, ...unit];
  }
}
```

### Issue 4: Attribute Row Not Selecting Parent
```typescript
// Fixed by component group detection
function selectTrack(state: AnimationData, trackPath: string): string[] {
  const parent = getParentPath(trackPath);
  
  if (parent && isComponentGroup(state, parent)) {
    // Select parent and all siblings
    return selectGroup(state, parent);
  }
  
  return [trackPath];
}
```

## Key Implementation Functions

```typescript
// Get all tracks under a group (recursive)
function getAllDescendantTracks(state: AnimationData, groupPath: string): string[] {
  const tracks: string[] = [];
  
  function traverse(path: string) {
    const children = getDirectChildren(state, path);
    
    for (const child of children) {
      if (hasChildren(state, child)) {
        traverse(child); // Recurse into groups
      } else {
        tracks.push(child); // Found a track
      }
    }
  }
  
  traverse(groupPath);
  return tracks;
}

// Get selection unit for any path
function getSelectionUnit(state: AnimationData, path: string): string[] {
  const entityType = classifyEntity(state, path);
  
  if (entityType === EntityType.Group) {
    return selectGroup(state, path);
  } else {
    return selectTrack(state, path);
  }
}

// Check if paths are siblings
function areSiblings(path1: string, path2: string): boolean {
  return getParentPath(path1) === getParentPath(path2);
}
```

## Benefits of This Approach

1. **Simplicity**: Only two types (group/track), one simple rule (has children?)
2. **Consistency**: All tracks are simple types, all complex types are groups
3. **Future-Proof**: Works at any depth without special cases
4. **Predictable**: Selection behavior follows clear rules
5. **Migratable**: Current system maps cleanly to future system

## Summary

The key insight is that **tracks are always leaf nodes with simple types**, and **groups are always containers**. This eliminates ambiguity and special cases. Complex datatypes like position/rotation aren't "vector3 tracks" - they're groups containing number tracks.

This makes the selection logic extremely simple:
- Groups select their entire subtree
- Tracks check if their parent is a component group
- Everything else follows from these two rules

The current system's "attributes" are just tracks at depth 4 whose parents happen to be component groups. This maps perfectly to the future system where they become regular tracks at any depth.