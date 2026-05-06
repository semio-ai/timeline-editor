import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

interface TrackMenuState {
  /** Whether any track menu (dropdown or context menu) is currently open. */
  menuOpen: boolean;
  /** Notify that a menu opened or closed. */
  setMenuOpen: (open: boolean) => void;
}

const TrackMenuContext = createContext<TrackMenuState>({
  menuOpen: false,
  setMenuOpen: () => {},
});

export function TrackMenuProvider({ children }: { children: ReactNode }) {
  // Ref + state combo: the ref counts open menus, the state drives re-renders.
  // Why a counter rather than a boolean: when one menu opens via a click that
  // also closes another (e.g. clicking the dropdown trigger of row B while
  // row A's context menu is open), Radix fires close→open in rapid succession
  // and the order of those callbacks is not guaranteed. A counter makes the
  // outcome order-independent — `menuOpen` only flips to false once every
  // open menu has reported its close.
  const openCountRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);

  const setMenuOpen = useCallback((open: boolean) => {
    openCountRef.current = Math.max(0, openCountRef.current + (open ? 1 : -1));
    const next = openCountRef.current > 0;
    setIsOpen((prev) => (prev !== next ? next : prev));
  }, []);

  const menuOpen = isOpen;

  const value = useMemo(() => ({ menuOpen, setMenuOpen }), [menuOpen, setMenuOpen]);

  return <TrackMenuContext.Provider value={value}>{children}</TrackMenuContext.Provider>;
}

export function useTrackMenuState(): TrackMenuState {
  return useContext(TrackMenuContext);
}
