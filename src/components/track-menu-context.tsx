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
  // Use a ref + state combo: the ref tracks the count of open menus (to handle
  // overlapping open/close callbacks), and the state drives re-renders.
  const openCountRef = useRef(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const setMenuOpen = useCallback((open: boolean) => {
    openCountRef.current = Math.max(0, openCountRef.current + (open ? 1 : -1));
    const next = openCountRef.current > 0;
    setIsMenuOpen((prev) => (prev !== next ? next : prev));
  }, []);

  const value = useMemo(
    () => ({ menuOpen: isMenuOpen, setMenuOpen }),
    [isMenuOpen, setMenuOpen],
  );

  return <TrackMenuContext.Provider value={value}>{children}</TrackMenuContext.Provider>;
}

export function useTrackMenuState(): TrackMenuState {
  return useContext(TrackMenuContext);
}
