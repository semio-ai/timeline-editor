import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo, type ReactNode } from "react";
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
import { testTrackEvaluator } from "@semio/animation";

/** Studio evaluates through @semio/studio-arora; stories use the test evaluator. */
import { createValuesStore, DataStoreContext, valuesDataStore } from "@semio/data";

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

/**
 * A standalone sheet using the test evaluator and an injected values store.
 * Studio evaluates through @semio/studio-arora.
 */
function AnimationSheetWithControls(): ReactNode {
  const store = useMemo(() => createTestAnimationStore(), []);
  const values = useMemo(() => valuesDataStore(createValuesStore()), []);
  const [ref, bounds] = useMeasure();
  useEffect(() => attachTestEvaluator(store), [store]);

  return (
    <DataStoreContext.Provider value={values}>
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
    </DataStoreContext.Provider>
  );
}

export const Preview: Story = {
  render: () => <AnimationSheetWithControls />,
};

function attachTestEvaluator(store: import("@semio/animation").AnimationStore) {
  store.setState({ trackEvaluator: testTrackEvaluator });
  return () => store.setState({ trackEvaluator: undefined });
}
