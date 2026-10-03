// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBlurInputsOnCanvasPointerDown } from "../hooks/use-canvas-input-blur";

function pointerDownOn(target: HTMLElement) {
  // jsdom lacks PointerEvent; a MouseEvent carries the same target/capture path.
  target.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
}

describe("useBlurInputsOnCanvasPointerDown", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("blurs a focused input when a pointer lands on a canvas", () => {
    const input = document.createElement("input");
    const canvas = document.createElement("canvas");
    document.body.append(input, canvas);
    renderHook(() => useBlurInputsOnCanvasPointerDown());

    input.focus();
    expect(document.activeElement).toBe(input);

    pointerDownOn(canvas);
    expect(document.activeElement).not.toBe(input);
  });

  it("leaves focus alone when the pointer lands on a non-canvas element", () => {
    const input = document.createElement("input");
    const div = document.createElement("div");
    document.body.append(input, div);
    renderHook(() => useBlurInputsOnCanvasPointerDown());

    input.focus();
    pointerDownOn(div);
    expect(document.activeElement).toBe(input);
  });
});
