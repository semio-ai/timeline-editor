/**
 * Browser test setup file for Playwright-based tests
 * This file provides utilities for browser tests without mocking browser APIs
 * since Playwright runs tests in a real browser environment
 */

import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Global test utilities

/**
 * Delay execution for a specified number of milliseconds
 */
export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Wait for Three.js/React Three Fiber to complete rendering
 * Waits for multiple animation frames to ensure the scene is fully rendered
 */
export const waitForRender = async (frames = 3): Promise<void> => {
  for (let i = 0; i < frames; i++) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
};

/**
 * Helper to get canvas element from container
 * React Three Fiber renders to a canvas element
 */
export const getCanvas = (container: HTMLElement): HTMLCanvasElement | null => {
  return container.querySelector("canvas");
};

/**
 * Helper to wait for a canvas to appear in the DOM
 */
export const waitForCanvas = async (
  container: HTMLElement,
  timeout = 5000,
): Promise<HTMLCanvasElement> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const canvas = getCanvas(container);
    if (canvas) return canvas;
    await delay(100);
  }

  throw new Error(`Canvas not found within ${String(timeout)}ms`);
};

/**
 * Console spy for capturing and inspecting console output during tests
 */
export interface ConsoleSpy {
  logs: string[];
  restore: () => void;
  getLogs: () => string[];
  clear: () => void;
}

export const spyConsole = (): ConsoleSpy => {
  const logs: string[] = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args: unknown[]) => {
    logs.push(
      `[LOG] ${args
        .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
        .join(" ")}`,
    );
    originalLog(...args);
  };

  console.warn = (...args: unknown[]) => {
    logs.push(
      `[WARN] ${args
        .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
        .join(" ")}`,
    );
    originalWarn(...args);
  };

  console.error = (...args: unknown[]) => {
    logs.push(
      `[ERROR] ${args
        .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
        .join(" ")}`,
    );
    originalError(...args);
  };

  return {
    logs,
    restore: () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    },
    getLogs: () => [...logs],
    clear: () => {
      logs.length = 0;
    },
  };
};

/**
 * Helper to simulate mouse drag operation
 * Note: When using Playwright, prefer using page.mouse.move() with steps
 */
export const simulateDrag = async (
  element: Element,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  steps = 10,
): Promise<void> => {
  // Create and dispatch mousedown event
  element.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: startX,
      clientY: startY,
      buttons: 1,
    }),
  );

  await delay(10);

  // Simulate drag movement in steps
  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    const x = startX + (endX - startX) * progress;
    const y = startY + (endY - startY) * progress;

    element.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        buttons: 1,
      }),
    );

    await delay(10);
  }

  // Create and dispatch mouseup event
  element.dispatchEvent(
    new MouseEvent("mouseup", {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: endX,
      clientY: endY,
      buttons: 0,
    }),
  );

  await delay(10);
};

/**
 * Helper to create mouse event with proper initialization
 */
export const createMouseEvent = (
  type: string,
  options: Partial<MouseEventInit> = {},
): MouseEvent => {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: 100,
    clientY: 100,
    screenX: 100,
    screenY: 100,
    ...options,
  });
};

/**
 * Helper to get bounding box with retry logic
 * Sometimes elements need time to be properly positioned
 */
export const getBoundingBox = async (
  element: Element,
  maxRetries = 10,
  retryDelay = 100,
): Promise<DOMRect> => {
  for (let i = 0; i < maxRetries; i++) {
    const box = element.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) {
      return box;
    }
    await delay(retryDelay);
  }
  throw new Error("Element bounding box not available");
};

/**
 * Helper to wait for a specific condition to be true
 */
export const waitFor = async (
  condition: () => boolean,
  timeout = 5000,
  checkInterval = 100,
): Promise<void> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (condition()) return;
    await delay(checkInterval);
  }

  throw new Error(`Condition not met within ${String(timeout)}ms`);
};

/**
 * Helper to wait for store state to update
 */
export const waitForStoreUpdate = async <T>(
  getState: () => T,
  predicate: (state: T) => boolean,
  timeout = 3000,
): Promise<T> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const state = getState();
    if (predicate(state)) return state;
    await delay(50);
  }

  throw new Error(`Store state did not update as expected within ${String(timeout)}ms`);
};

/**
 * Helper to normalize canvas coordinates
 * Converts page coordinates to canvas-relative coordinates
 */
export const toCanvasCoordinates = (
  canvas: HTMLCanvasElement,
  pageX: number,
  pageY: number,
): { x: number; y: number } => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: pageX - rect.left,
    y: pageY - rect.top,
  };
};

/**
 * Helper to get normalized position within canvas (0-1 range)
 */
export const getNormalizedCanvasPosition = (
  canvas: HTMLCanvasElement,
  pageX: number,
  pageY: number,
): { x: number; y: number } => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (pageX - rect.left) / rect.width,
    y: (pageY - rect.top) / rect.height,
  };
};

// Re-export testing library utilities for convenience
export { cleanup } from "@testing-library/react";
export { vi } from "vitest";
