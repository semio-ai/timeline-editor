import { useEffect, useRef } from "react";

/**
 * Whether the Control key is physically held, as a ref read at event time.
 *
 * Chromium delivers a trackpad pinch as wheel events with `ctrlKey` set while
 * Control is not held, so a wheel event's own `ctrlKey` cannot tell a pinch from a
 * Ctrl+wheel. Keyboard and pointer events report Control's real state, so this
 * follows those: key presses and releases, and any pointer movement or press,
 * which also catches a Control pressed while the page lacked focus. Losing focus
 * clears it, since the release would go unseen.
 */
export function useControlKeyHeld(): { readonly current: boolean } {
  const held = useRef(false);

  useEffect(() => {
    const fromKey = (event: KeyboardEvent) => {
      held.current = event.key === "Control" ? event.type === "keydown" : event.ctrlKey;
    };
    const fromPointer = (event: PointerEvent) => {
      held.current = event.ctrlKey;
    };
    const clear = () => {
      held.current = false;
    };
    const options = { capture: true, passive: true } as const;
    document.addEventListener("keydown", fromKey, options);
    document.addEventListener("keyup", fromKey, options);
    document.addEventListener("pointermove", fromPointer, options);
    document.addEventListener("pointerdown", fromPointer, options);
    window.addEventListener("blur", clear);
    return () => {
      document.removeEventListener("keydown", fromKey, options);
      document.removeEventListener("keyup", fromKey, options);
      document.removeEventListener("pointermove", fromPointer, options);
      document.removeEventListener("pointerdown", fromPointer, options);
      window.removeEventListener("blur", clear);
    };
  }, []);

  return held;
}
