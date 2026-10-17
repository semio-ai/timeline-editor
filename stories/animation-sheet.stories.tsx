import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo, type ReactNode } from "react";
import useMeasure from "react-use-measure";
import {
  AnimationSheet,
  AnimationContext,
  type AnimationSheetProps,
  type AnimationStore,
  createTestAnimationStore,
  createMinimalAnimationStore,
  INSTANCE_IDS,
  TrackRender,
  useAnimationStore,
} from "@semio/animation";
import { attachModuleBaker } from "@semio/animation/module-baker";
import { Text, TextRole } from "@semio/ui";
import { createValuesStore, DataStoreContext, valuesDataStore } from "@semio/utils";

const meta = {
  title: "animation/AnimationSheet",
  component: AnimationSheet,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof AnimationSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The sheet on a store of its own, its values in a store the story injects.
 * With `bake`, its curves come from the Vizij animation module, which the
 * package runs in the page through `@vizij/runtime` (`attachModuleBaker`):
 * no device, no Studio. Without it, nothing bakes and the curves are drawn
 * from the authored Béziers, with no values or violations.
 */
function AnimationSheetWithStore({
  storeType = "full",
  bake = true,
  trackRender,
  ...props
}: AnimationSheetProps & {
  storeType?: "full" | "minimal" | "namespaceA" | "namespaceB";
  bake?: boolean;
  /** How every view of the sheet draws its tracks, when not the store's default. */
  trackRender?: TrackRender;
}): ReactNode {
  const [ref, bounds] = useMeasure();
  const values = useMemo(() => valuesDataStore(createValuesStore()), []);

  const store = useMemo((): AnimationStore => {
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
  }, [storeType]);

  useEffect(() => (bake ? attachModuleBaker(store) : undefined), [store, bake]);
  useEffect(() => {
    if (trackRender === undefined) return;
    for (const viewId of Object.keys(store.getState().editorViews)) {
      store.getState().updateView(viewId, { trackRender });
    }
  }, [store, trackRender]);

  return (
    <DataStoreContext.Provider value={values}>
      <AnimationContext.Provider value={store}>
        <div ref={ref} style={{ width: "100vw", height: "100vh", minHeight: 400 }}>
          {bake && <BakeStatus />}
          <AnimationSheet
            {...props}
            height={props.height ?? (bounds.height > 0 ? bounds.height : 600)}
            fonts={{
              mono: "fonts/roboto-mono-regular.ttf",
              ui: "fonts/roboto-regular.ttf",
            }}
          />
        </div>
      </AnimationContext.Provider>
    </DataStoreContext.Provider>
  );
}

/** How many of the sheet's tracks have a curve the module baked. */
function BakeStatus(): ReactNode {
  const tracks = useAnimationStore((state) => state.derivedSnapshot?.tracks);
  const all = Object.values(tracks ?? {});
  const baked = all.filter((track) => track.canonical.curve(0) !== undefined).length;
  return (
    <Text role={TextRole.Note} data-testid="bake-status">
      Curves baked by the Vizij animation module: {baked} of {all.length} tracks
    </Text>
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

/**
 * The spline view: each value row's curve, as the bundled module bakes it
 */
export const Splines: Story = {
  render: () => <AnimationSheetWithStore storeType="full" trackRender={TrackRender.Spline} />,
};

/**
 * Nothing bakes: curves drawn from the authored Béziers, no values or violations
 */
export const WithoutBaker: Story = {
  render: () => <AnimationSheetWithStore storeType="full" bake={false} />,
};
