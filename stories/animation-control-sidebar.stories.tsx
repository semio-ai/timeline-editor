import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode } from "react";
import useMeasure from "react-use-measure";
import {
  AnimationSheet,
  AnimationContext,
  AnimatableControlList,
  ColorContextProvider,
  NameContextProvider,
  LocalGlobalTransformContextProvider,
  createTestAnimationStore,
} from "@semio/animation";

const meta = {
  title: "animation/ControlSidebarPreview",
  component: AnimationSheet,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof AnimationSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlsList(): ReactNode {
  return <AnimatableControlList listClassName="gap-0 p-3" />;
}

function AnimationSheetWithControls(): ReactNode {
  const store = createTestAnimationStore();
  const [ref, bounds] = useMeasure();

  return (
    <AnimationContext.Provider value={store}>
      <ColorContextProvider>
        <NameContextProvider>
          <LocalGlobalTransformContextProvider>
            <div className="grid h-screen grid-cols-[2fr_1fr]">
              <div ref={ref} className="min-h-100">
                <AnimationSheet
                  height={bounds.height || 600}
                  fonts={{
                    mono: "fonts/roboto-mono-regular.ttf",
                    ui: "fonts/roboto-regular.ttf",
                  }}
                />
              </div>
              <div className="overflow-y-auto border-l border-neutral-800 bg-neutral-950">
                <ControlsList />
              </div>
            </div>
          </LocalGlobalTransformContextProvider>
        </NameContextProvider>
      </ColorContextProvider>
    </AnimationContext.Provider>
  );
}

export const Preview: Story = {
  render: () => <AnimationSheetWithControls />,
};
