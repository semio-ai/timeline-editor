# Track List 3D Scroll Synchronization Roadmap

## Overview

This document outlines the implementation plan for synchronizing scroll positions between the track list panel and the 3D viewport in the `TrackList3D` component. The goal is to ensure that scrolling in either area updates the corresponding position in the other, creating a cohesive user experience.

## Current State

- `TrackList3D` has a left panel with `ScrollArea` containing track rows (`TrackRow3D` components)
- Right panel contains a `View` component with a beige background
- No scroll synchronization exists between the two panels
- The `ScrollArea` component supports controlled mode and bidirectional synchronization (as shown in stories)

## Implementation Approach

### Stage 1: Setup Bidirectional ScrollArea in TrackList3D

**Objective**: Implement controlled scroll behavior in the track list panel similar to the `BidirectionalSynchronizedOverscroll` story example.

**Tasks:**
1. **Convert ScrollArea to controlled mode**
   - Add state management for `scrollTop` and `scrollLeft` 
   - Implement `onScrollChange` handler to update state
   - Add `scrollTop` prop to control the ScrollArea position

2. **Add scroll state management**
   ```tsx
   const [scrollState, setScrollState] = useState({
     scrollTop: 0,
     scrollLeft: 0
   });
   ```

3. **Implement scroll change handler**
   ```tsx
   const handleScrollChange = useCallback((scrollInfo: ScrollInfo) => {
     setScrollState({
       scrollTop: scrollInfo.scrollTop,
       scrollLeft: scrollInfo.scrollLeft
     });
   }, []);
   ```

4. **Update ScrollArea props**
   - Add `scrollTop={scrollState.scrollTop}`
   - Add `onScrollChange={handleScrollChange}`
   - Consider enabling `enableOverscrollEffect` for visual feedback

**Files to modify:**
- `semio_studio/packages/animation/src/components/three/track-list-3d.tsx`

**Dependencies:**
- No new dependencies required (ScrollArea already supports controlled mode)

---

### Stage 2: Render Synchronized Rows in 3D View

**Objective**: Create corresponding visual elements in the 3D View that match each track row in the left panel.

**Tasks:**
1. **Create 3D row representation component**
   - Design a simple 3D element (plane, box, or custom geometry) to represent each track
   - Ensure consistent height with `TrackRow3D` components
   - Position elements vertically to match track list layout

2. **Implement row positioning logic**
   - Calculate vertical positions based on track index and row height
   - Ensure consistent spacing with left panel ScrollArea content
   - Account for padding/margins in the layout

3. **Create ViewTrackRow3D component**
   ```tsx
   function ViewTrackRow3D({
     trackId,
     position,
     height,
     // other props
   }: ViewTrackRow3DProps) {
     return (
       <mesh position={[0, position, 0]}>
         <planeGeometry args={[width, height]} />
         <meshBasicMaterial color="lightblue" />
       </mesh>
     );
   }
   ```

4. **Update View content**
   - Replace static beige background with scrollable content container
   - Render `ViewTrackRow3D` for each track
   - Implement proper 3D camera and scene setup

**Files to create/modify:**
- Create: `semio_studio/packages/animation/src/components/three/view-track-row-3d.tsx`
- Modify: `semio_studio/packages/animation/src/components/three/track-list-3d.tsx`

**Dependencies:**
- Three.js geometry and material components
- React Three Fiber components

---

### Stage 3: Implement Scroll Synchronization

**Objective**: Synchronize scroll positions between the track list ScrollArea and the 3D View camera/content positioning.

**Tasks:**
1. **Setup 3D camera/content scroll state**
   - Create shared scroll state that affects both panels
   - Implement camera position updates based on scroll state
   - Ensure consistent scroll ranges between 2D and 3D areas

2. **Implement bidirectional synchronization**
   - Track list scroll updates → 3D view camera position
   - 3D view interaction updates → track list scroll position
   - Handle overscroll effects in both directions

3. **Add 3D view interaction handlers**
   ```tsx
   const handle3DScroll = useCallback((newScrollTop: number) => {
     setScrollState(prev => ({
       ...prev,
       scrollTop: newScrollTop
     }));
   }, []);
   ```

4. **Synchronize scroll bounds**
   - Calculate total content height in both panels
   - Ensure consistent scroll limits
   - Handle edge cases (empty content, dynamic content changes)

5. **Performance optimization**
   - Implement scroll debouncing if needed
   - Optimize 3D rendering during scroll operations
   - Consider using `useTransition` for smooth updates

6. **Add scroll interaction controls**
   - Mouse wheel handling in 3D view
   - Touch/gesture support for mobile
   - Keyboard navigation support

**Files to modify:**
- `semio_studio/packages/animation/src/components/three/track-list-3d.tsx`
- `semio_studio/packages/animation/src/components/three/view-track-row-3d.tsx`

**Dependencies:**
- React Three Fiber event handling
- Three.js camera controls
- Potentially `@react-three/drei` utilities

---

## Technical Considerations

### ScrollArea Integration
- Leverage existing `ScrollArea` controlled mode capabilities
- Use `ScrollInfo` and `ViewportInfo` types for consistent data handling
- Consider `enableOverscrollEffect` for enhanced user feedback

### 3D Rendering Performance
- Optimize re-renders during scroll operations
- Use `useMemo` and `useCallback` appropriately
- Consider virtualization for large track counts

### State Management
- Determine if scroll state should be local or in animation store
- Handle race conditions between scroll sources
- Ensure state consistency across re-renders

### User Experience
- Maintain smooth 60fps scrolling performance
- Provide visual feedback for scroll synchronization
- Handle edge cases gracefully (no tracks, loading states)

## Success Criteria

1. **Stage 1 Complete**: Track list uses controlled ScrollArea with state management
2. **Stage 2 Complete**: 3D view renders rows corresponding to each track with proper positioning
3. **Stage 3 Complete**: Scrolling in either panel smoothly updates the other panel's position

## Future Enhancements

- Smooth scroll animations between synchronized areas
- Advanced 3D visualizations for track content
- Keyboard shortcuts for navigation
- Accessibility improvements for screen readers
- Multi-touch gesture support

## References

- `ScrollArea` component documentation and stories
- `BidirectionalSynchronizedOverscroll` story implementation
- React Three Fiber camera controls documentation
- Animation store architecture docs