# Pop-Out Window Architecture for Animation Sheets

## Overview

This document outlines the proposed architecture for implementing pop-out windows in the animation sheet component system. The goal is to enable users to spawn separate browser windows containing independent animation sheet views while maintaining proper lifecycle management and clean separation of concerns.

## Requirements

### Functional Requirements
- **Root sheets** can spawn child windows with their own animation-sheet components
- **Child sheets** cannot spawn additional windows (no popout button visible)
- Closing a child window removes that sheet and view
- Original sheet remains when popping out (creating multiple concurrent views)
- Each window maintains its own viewport and rendering context

### Technical Requirements
- Use native browser windows (not modals)
- Leverage existing multi-view infrastructure without modification
- Maintain React component hierarchy
- Handle window lifecycle events properly
- **Clean separation**: Window management in `@semio/ui`, animation logic in `@semio/animation`

## Architecture Principles

### Separation of Concerns
- **@semio/ui**: Provides generic window management infrastructure
- **@semio/animation**: Uses window management API, maintains view registration pattern
- Animation store remains unaware of windows (only tracks views as currently implemented)
- No window-specific code in animation store

## Implementation Approach

### Option 1: react-popout Library

**Pros:**
- Battle-tested solution
- Handles window lifecycle automatically
- Simple API integration

**Cons:**
- Outdated, may not support React 18+ features
- Limited customization options
- Would still need wrapper in @semio/ui

### Option 2: Custom Window Management in @semio/ui (Recommended)

**Pros:**
- Full control over implementation
- TypeScript-first approach
- Reusable across entire application
- Clean separation from animation logic
- Can be used by any component, not just animation sheets

**Cons:**
- More initial development effort

## Proposed Architecture

### 1. Generic Window Portal Component (@semio/ui)

Create a reusable window portal component in the UI library:

```typescript
// @semio/ui/src/components/window-portal/window-portal.tsx
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, useCallback } from 'react';

export interface WindowPortalProps {
  isOpen: boolean;
  windowId: string;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  height?: number;
  features?: WindowFeatures;
  copyStyles?: boolean;
  className?: string;
}

export interface WindowFeatures {
  left?: number;
  top?: number;
  offsetFromParent?: boolean;
  resizable?: boolean;
  scrollbars?: boolean;
  toolbar?: boolean;
  menubar?: boolean;
  location?: boolean;
  status?: boolean;
}

export function WindowPortal({ 
  isOpen, 
  windowId,
  title = 'Pop-out Window',
  onClose, 
  children,
  width = 1200,
  height = 800,
  features = {},
  copyStyles = true,
  className
}: WindowPortalProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const windowRef = useRef<Window | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (windowRef.current && !windowRef.current.closed) {
        windowRef.current.close();
      }
      return;
    }

    // Calculate position
    const left = features.offsetFromParent 
      ? (window.screenX || 0) + 50 
      : (features.left ?? window.screen.width / 2 - width / 2);
    const top = features.offsetFromParent 
      ? (window.screenY || 0) + 50 
      : (features.top ?? window.screen.height / 2 - height / 2);

    // Build features string
    const featuresStr = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      `resizable=${features.resizable !== false ? 'yes' : 'no'}`,
      `scrollbars=${features.scrollbars !== false ? 'yes' : 'no'}`,
      `toolbar=${features.toolbar ? 'yes' : 'no'}`,
      `menubar=${features.menubar ? 'yes' : 'no'}`,
      `location=${features.location ? 'yes' : 'no'}`,
      `status=${features.status ? 'yes' : 'no'}`
    ].join(',');

    // Open window
    const newWindow = window.open('', windowId, featuresStr);
    
    if (!newWindow) {
      console.error('Failed to open window - check popup blocker settings');
      onClose();
      return;
    }

    windowRef.current = newWindow;
    newWindow.document.title = title;
    
    // Copy styles from parent if requested
    if (copyStyles) {
      const styles = Array.from(document.styleSheets);
      const head = newWindow.document.head;
      
      // Clear existing styles
      head.innerHTML = '';
      
      styles.forEach(styleSheet => {
        try {
          if (styleSheet.href) {
            const link = newWindow.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = styleSheet.href;
            head.appendChild(link);
          } else if (styleSheet.cssRules) {
            const style = newWindow.document.createElement('style');
            Array.from(styleSheet.cssRules).forEach(rule => {
              style.appendChild(newWindow.document.createTextNode(rule.cssText));
            });
            head.appendChild(style);
          }
        } catch (e) {
          console.warn('Could not copy stylesheet:', e);
        }
      });
    }

    // Copy body classes for theme support
    newWindow.document.body.className = document.body.className;
    if (className) {
      newWindow.document.body.classList.add(...className.split(' '));
    }
    
    // Create container
    const containerEl = newWindow.document.createElement('div');
    containerEl.id = `${windowId}-root`;
    containerEl.className = 'window-portal-root w-full h-full';
    newWindow.document.body.appendChild(containerEl);
    
    setContainer(containerEl);

    // Handle close
    const handleBeforeUnload = () => onClose();
    newWindow.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      newWindow.removeEventListener('beforeunload', handleBeforeUnload);
      if (!newWindow.closed) {
        newWindow.close();
      }
      setContainer(null);
    };
  }, [isOpen, windowId, title, onClose, width, height, features, copyStyles, className]);

  if (!isOpen || !container) {
    return null;
  }

  return createPortal(children, container);
}
```

### 2. Window Provider Context (@semio/ui)

Optional context for managing multiple windows:

```typescript
// @semio/ui/src/components/window-portal/window-context.tsx
import { createContext, useContext, useState, useCallback } from 'react';

interface WindowInfo {
  id: string;
  isOpen: boolean;
  parentId?: string;
}

interface WindowContextValue {
  windows: Map<string, WindowInfo>;
  registerWindow: (id: string, parentId?: string) => void;
  unregisterWindow: (id: string) => void;
  isWindowOpen: (id: string) => boolean;
  getChildWindows: (parentId: string) => string[];
}

const WindowContext = createContext<WindowContextValue | null>(null);

export function WindowProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<Map<string, WindowInfo>>(new Map());

  const registerWindow = useCallback((id: string, parentId?: string) => {
    setWindows(prev => {
      const next = new Map(prev);
      next.set(id, { id, isOpen: true, parentId });
      return next;
    });
  }, []);

  const unregisterWindow = useCallback((id: string) => {
    setWindows(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isWindowOpen = useCallback((id: string) => {
    return windows.get(id)?.isOpen ?? false;
  }, [windows]);

  const getChildWindows = useCallback((parentId: string) => {
    return Array.from(windows.values())
      .filter(w => w.parentId === parentId)
      .map(w => w.id);
  }, [windows]);

  return (
    <WindowContext.Provider value={{
      windows,
      registerWindow,
      unregisterWindow,
      isWindowOpen,
      getChildWindows
    }}>
      {children}
    </WindowContext.Provider>
  );
}

export function useWindowContext() {
  const context = useContext(WindowContext);
  if (!context) {
    throw new Error('useWindowContext must be used within WindowProvider');
  }
  return context;
}
```

### 3. Export from @semio/ui

```typescript
// @semio/ui/src/index.ts
export { WindowPortal } from './components/window-portal/window-portal';
export { WindowProvider, useWindowContext } from './components/window-portal/window-context';
export type { WindowPortalProps, WindowFeatures } from './components/window-portal/window-portal';
```

### 4. Usage in AnimationSheet (@semio/animation)

The animation sheet simply uses the UI library's window management:

```typescript
// @semio/animation/src/components/animation-sheet.tsx
import { WindowPortal } from '@semio/ui';
import { useState, useCallback, useId } from 'react';

interface AnimationSheetProps {
  // ... existing props
  isChild?: boolean;  // Indicates if this is a child window
}

function InnerSheet({ 
  onToggleExpand, 
  height = MIN_SHEET_HEIGHT, 
  fonts = {},
  isChild = false  // New prop
}: AnimationSheetProps): ReactNode {
  const { resolvedTheme } = useTheme();
  
  // Existing view management - unchanged
  const viewInitialized = useRef(false);
  const viewId = useId();
  const [addView, removeView] = useAnimationStore(
    useShallow((state) => [state.addView, state.removeView]),
  );

  useEffect(() => {
    if (!viewInitialized.current) {
      viewInitialized.current = true;
      addView({ id: viewId, trackRender: TrackRender.Key });
    }
    return () => {
      viewInitialized.current = false;
      removeView(viewId);
    };
  }, [viewId, removeView, addView]);

  // Pop-out state management
  const [popped, setPopped] = useState(false);
  const childViewId = useId(); // Generate ID for potential child
  const [childViewActive, setChildViewActive] = useState(false);

  const handlePopout = useCallback(() => {
    if (!isChild) {
      setPopped(true);
      setChildViewActive(true);
    }
  }, [isChild]);

  const handlePopoutClose = useCallback(() => {
    setPopped(false);
    setChildViewActive(false);
  }, []);

  return (
    <>
      <div className="animation-sheet-container w-full pointer-events-auto">
        <div className="grid grid-cols-[302px_1fr] group/sheet w-full pr-0.5 pb-0.5">
          {/* Pop-out button - only shown for root sheets */}
          <div className="flex flex-1 flex-row h-8 items-center justify-between px-1">
            {/* ... other controls ... */}
            
            {!isChild && (
              <ToggleSquare
                sizing="inner"
                size={Size.Sm}
                value={popped}
                onChange={handlePopout}
                label="Pop Out"
              >
                <IconArrowUpRight size="11px" />
              </ToggleSquare>
            )}
          </div>
          
          {/* Rest of existing component */}
        </div>
      </div>

      {/* Pop-out window portal */}
      {!isChild && (
        <WindowPortal
          isOpen={popped && childViewActive}
          windowId={`animation-sheet-${childViewId}`}
          title="Animation Sheet - View"
          onClose={handlePopoutClose}
          width={1200}
          height={600}
          features={{
            offsetFromParent: true,
            resizable: true
          }}
          copyStyles={true}
          className="animation-sheet-window"
        >
          {/* Child animation sheet reusing parent's contexts */}
          <AnimationSheet
            {...props}
            isChild={true}
            skipAnimationContext={true}  // Reuse parent's AnimationContext
            skipTooltipContext={true}    // Reuse parent's TooltipContext
          />
        </WindowPortal>
      )}
    </>
  );
}
```

## Key Design Decisions

### 1. Complete Separation
- Window management is completely generic and lives in @semio/ui
- Animation sheets just use windows like any other UI component
- No animation-specific logic in window management
- No window-specific logic in animation store

### 2. View Independence
- Each AnimationSheet (root or child) manages its own view lifecycle
- Views are registered on mount and cleaned up on unmount
- The animation store doesn't need to know if a view is in a window or not

### 3. Context Reuse
- Child windows reuse the parent's AnimationContext and TooltipContext
- This ensures shared state and consistent behavior across windows
- The React portal mechanism maintains context continuity

## Implementation Plan

### Phase 1: UI Library Window Infrastructure
1. Implement `WindowPortal` component in @semio/ui
2. Add proper TypeScript types and exports
3. Test with simple content
4. Add style copying mechanism

### Phase 2: Animation Sheet Integration
1. Add `isChild` prop to AnimationSheet
2. Integrate WindowPortal for pop-out
3. Test view lifecycle (registration/cleanup)
4. Verify context isolation

### Phase 3: Polish
1. Add window position memory (localStorage)
2. Improve style copying for themes
3. Add loading states
4. Handle edge cases

### Phase 4: Future Enhancements
1. Multi-window support (multiple children)
2. Window arrangement presets
3. Synchronized playback across windows
4. Window state persistence

## Benefits of This Approach

### 1. Reusability
- WindowPortal can be used by any component in the application
- Not tied to animation logic

### 2. Maintainability
- Clear separation of concerns
- Each library maintains its own domain
- Easy to test in isolation

### 3. Flexibility
- Animation sheets work the same in main window or pop-out
- No special cases in animation logic
- Window management can evolve independently

## Testing Strategy

### Unit Tests (@semio/ui)
- WindowPortal lifecycle
- Style copying
- Event handling
- Browser compatibility

### Integration Tests (@semio/animation)
- View registration/cleanup in pop-outs
- Context isolation
- Props passing
- User interactions

## Migration Path

1. **Current**: Pop-out button logs data
2. **Step 1**: Implement WindowPortal in @semio/ui
3. **Step 2**: Basic integration in AnimationSheet
4. **Step 3**: Test and refine
5. **Step 4**: Add advanced features

## Conclusion

By keeping window management in @semio/ui and maintaining the existing view lifecycle in @semio/animation, we achieve a clean, maintainable architecture. The animation store remains focused on animation logic, while the UI library provides reusable windowing capabilities that can benefit the entire application.

This approach respects the existing architecture, minimizes coupling, and provides a solid foundation for future enhancements.