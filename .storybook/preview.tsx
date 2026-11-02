import React, { useEffect } from "react";
import { Preview } from "@storybook/react-vite";
import "./styles.css";
import { IconProvider, Theme, ThemeContext } from "@semio/ui";
import { animationIconRegistry } from "@semio/timeline-editor";

export const globalTypes = {
  theme: {
    name: "Theme",
    description: "Global theme for components",
    defaultValue: "light",
    toolbar: {
      icon: "circlehollow",
      items: [
        { value: Theme.Light, title: "Light" },
        { value: Theme.Dark, title: "Dark" },
      ],
      showName: true,
    },
  },
};

function ThemeProvider({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme: Theme.Light | Theme.Dark;
}) {
  // Toggle the `dark` class on `<html>` so Radix `Dialog.Portal` (and other
  // portaled overlays rendered into `document.body`) inherit dark mode.
  // Without this, the `&:where(.dark, .dark *)` selector misses portaled
  // content because portals are siblings of — not descendants of — the
  // wrapper div below.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === Theme.Dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    return () => {
      root.classList.remove("dark");
    };
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        explicitTheme: theme,
        resolvedTheme: theme,
        systemPreference: theme,
        setExplicitTheme: () => {},
      }}
    >
      <div className={theme === "dark" ? "dark" : ""}>{children}</div>
    </ThemeContext.Provider>
  );
}

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
  },

  decorators: [
    // The editor's components name keys only `animationIconRegistry` provides, so every
    // story renders inside it, as a consuming application renders the editor.
    (Story, context) => (
      <ThemeProvider theme={context.globals.theme}>
        <IconProvider registry={animationIconRegistry}>
          <div className="w-full min-h-10 bg-neutral-200 dark:bg-neutral-800 m-0">
            <Story />
          </div>
        </IconProvider>
      </ThemeProvider>
    ),
  ],

  tags: ["autodocs"],
};

export default preview;
