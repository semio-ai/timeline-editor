/// <reference types="vitest" />
/// <reference types="@vitest/browser/matchers" />
/// <reference types="@vitest/browser/providers/playwright" />

/**
 * TypeScript definitions for Vitest browser mode with Playwright
 * This file ensures proper type support for browser-specific APIs and matchers
 */

declare module "@vitest/browser/context" {
  // The page object is provided by Vitest browser mode
  export const page: import("@vitest/browser").BrowserPage;
  export const userEvent: import("@vitest/browser").UserEvent;
  export const commands: import("@vitest/browser").BrowserCommands;
  export const server: import("@vitest/browser").BrowserServer;
}

// Extend the global namespace for browser-specific test utilities
declare global {
  namespace Vi {
    interface Assertion {
      // Additional browser-specific matchers are added by @vitest/browser/matchers
      toBeInTheDocument: () => void;
      toHaveTextContent: (text: string | RegExp) => void;
      toBeVisible: () => void;
      toBeDisabled: () => void;
      toBeEnabled: () => void;
      toHaveFocus: () => void;
      toHaveAttribute: (attr: string, value?: string | RegExp) => void;
      toHaveClass: (...classNames: string[]) => void;
      toHaveStyle: (style: Record<string, any>) => void;
      toHaveValue: (value: string | string[] | number) => void;
      toBeChecked: () => void;
      toBePartiallyChecked: () => void;
      toHaveFormValues: (values: Record<string, any>) => void;
    }

    interface ExpectStatic {
      element: (element: Element | null) => Assertion;
    }
  }
}

// Export empty object to make this a module
export {};
