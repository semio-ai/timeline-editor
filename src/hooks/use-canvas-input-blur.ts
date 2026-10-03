import { useEffect } from "react";

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * Blur a focused editable element when a pointer interaction begins on a WebGL
 * canvas.
 *
 * Clicking inside a `<canvas>` (an R3F surface) does not blur a focused DOM
 * input the way clicking a normal element does — the canvas isn't a focusable
 * sibling and R3F runs its own event system. So after editing a value/name
 * field and moving to the canvas, the field stays focused, and global hotkeys
 * get swallowed by it (e.g. pressing Delete on a selected key deletes text in
 * the field instead of the key, because @mantine/hooks ignores INPUT targets).
 *
 * Listen in the capture phase so this runs regardless of R3F's handling, and
 * only act when the pointer actually landed on a canvas. Blurring also commits
 * any pending field edit, which is the desired hand-off behavior.
 */
export function useBlurInputsOnCanvasPointerDown(): void {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.tagName !== "CANVAS") return;
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        (EDITABLE_TAGS.has(active.tagName) || active.isContentEditable)
      ) {
        active.blur();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);
}
