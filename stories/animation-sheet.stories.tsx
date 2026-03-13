import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode } from "react";
import useMeasure from "react-use-measure";
import {
  AnimationSheet,
  AnimationContext,
  type AnimationSheetProps,
  createTestAnimationStore,
  createMinimalAnimationStore,
  INSTANCE_IDS,
} from "@semio/animation";

const meta = {
  title: "animation/AnimationSheet",
  component: AnimationSheet,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof AnimationSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

function AnimationSheetWithStore({
  storeType = "full",
  ...props
}: AnimationSheetProps & {
  storeType?: "full" | "minimal" | "namespaceA" | "namespaceB";
}): ReactNode {
  const [ref, bounds] = useMeasure();

  const store = (() => {
    switch (storeType) {
      case "minimal":
        return createMinimalAnimationStore();
      case "namespaceA":
        return createTestAnimationStore({
          includeNamespaceA: true,
          includeNamespaceB: false,
          activeInstance: INSTANCE_IDS.ALPHA_SHARED,
        });
      case "namespaceB":
        return createTestAnimationStore({
          includeNamespaceA: false,
          includeNamespaceB: true,
          activeInstance: INSTANCE_IDS.BETA_SHARED,
        });
      default:
        return createTestAnimationStore();
    }
  })();

  return (
    <AnimationContext.Provider value={store}>
      <div ref={ref} style={{ width: "100vw", height: "100vh", minHeight: 400 }}>
        <AnimationSheet
          {...props}
          height={props.height || bounds.height || 600}
          fonts={{
            mono: "fonts/roboto-mono-regular.ttf",
            ui: "fonts/roboto-regular.ttf",
          }}
        />
      </div>
    </AnimationContext.Provider>
  );
}

/**
 * Default animation sheet with two namespaces and shared animations
 */
export const Default: Story = {
  render: () => <AnimationSheetWithStore storeType="full" />,
};

/**
 * Animation sheet with only Namespace A animations
 */
export const NamespaceAOnly: Story = {
  render: () => <AnimationSheetWithStore storeType="namespaceA" />,
};

/**
 * Animation sheet with only Namespace B animations
 */
export const NamespaceBOnly: Story = {
  render: () => <AnimationSheetWithStore storeType="namespaceB" />,
};

/**
 * Minimal animation sheet with single track
 */
export const Minimal: Story = {
  render: () => <AnimationSheetWithStore storeType="minimal" />,
};
