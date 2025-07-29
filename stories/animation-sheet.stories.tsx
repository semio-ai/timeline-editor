import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useContext, useState, useCallback, type ReactNode } from "react";
import {
  AnimationSheet,
  AnimationContext,
  type AnimationSheetProps,
  type AnimationData,
  type AnimationActions,
  createAnimationStore,
} from "@semio/animation";
import { usePlayerStore } from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import { useShallow } from "zustand/shallow";
import {
  sharedAnimatables,
  getSharedAnimation,
  sharedTracks,
  createKeypoints,
  createAnimationInstances,
  createNamespaceInfo,
  createComplexAnimation,
  SHARED_ANIMATION_ID,
  SHARED_DURATION,
} from "./prebuilt/shared-animation-data";

const meta = {
  title: "animation/AnimationSheet",
  component: AnimationSheetWithContext,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof AnimationSheetWithContext>;

export default meta;
type Story = StoryObj<typeof meta>;

interface AnimationSheetWithContextProps extends AnimationSheetProps {
  initial?: Partial<AnimationData & AnimationActions>;
  storeInstance?: ReturnType<typeof createAnimationStore>;
}

function AnimationSheetWithContext({
  namespaceId,
  animationInstances,
  onToggleExpand,
  height,
  storeInstance,
}: AnimationSheetWithContextProps): ReactNode {
  const store = storeInstance || createAnimationStore();

  return (
    <AnimationContext.Provider value={store}>
      <AppWithAnimation
        namespaceId={namespaceId}
        animationInstances={animationInstances}
        onToggleExpand={onToggleExpand}
        height={height}
      />
    </AnimationContext.Provider>
  );
}

function AppWithAnimation({
  namespaceId,
  animationInstances,
  onToggleExpand,
  height,
}: AnimationSheetProps): ReactNode {
  const store = useContext(AnimationContext);

  if (!store) {
    throw new Error("AnimationContext must be provided");
  }

  const {
    setAnimations,
    setTracks,
    setAnimatables,
    createKeypoints: createKeypointsAction,
    updateFramerate,
    setTimeDisplay,
  } = store(
    useShallow((state) => ({
      setAnimations: state.setAnimations,
      setTracks: state.setTracks,
      setAnimatables: state.setAnimatables,
      createKeypoints: state.createKeypoints,
      updateFramerate: state.updateFramerate,
      setTimeDisplay: state.setTimeDisplay,
    })),
  );

  const updateDuration = usePlayerStore((state) => state.updateDuration);

  useEffect(() => {
    // Batch all core data setup to prevent intermediate render states
    const initializeData = () => {
      // Set all core data in rapid succession to minimize intermediate states
      setAnimatables(sharedAnimatables);
      setAnimations(getSharedAnimation());
      setTracks(sharedTracks);

      // Set up namespace info immediately after core data
      const storeState = store.getState();
      if (storeState.namespaceInfo !== undefined) {
        Object.assign(storeState, { namespaceInfo: createNamespaceInfo(SHARED_ANIMATION_ID) });
      }

      // Create keyframes after all structure is in place
      const keypoints = createKeypoints();
      createKeypointsAction(keypoints);

      // Finally update display settings
      updateFramerate(30);
      setTimeDisplay(TimeDisplay.Frames);
      updateDuration(SHARED_DURATION);
    };

    // Use setTimeout to ensure all state updates happen after current render cycle
    setTimeout(initializeData, 0);
  }, [
    setAnimations,
    setTracks,
    setAnimatables,
    createKeypointsAction,
    updateFramerate,
    setTimeDisplay,
    updateDuration,
  ]);

  return (
    <div className="p-4">
      <AnimationSheet
        namespaceId={namespaceId}
        animationInstances={animationInstances}
        onToggleExpand={onToggleExpand}
        height={height}
      />
    </div>
  );
}

function ComplexAnimationApp(): ReactNode {
  const store = useContext(AnimationContext);

  if (!store) {
    throw new Error("AnimationContext must be provided");
  }

  const {
    setAnimations,
    setTracks,
    setAnimatables,
    createKeypoints: createKeypointsAction,
    updateFramerate,
    setTimeDisplay,
  } = store(
    useShallow((state) => ({
      setAnimations: state.setAnimations,
      setTracks: state.setTracks,
      setAnimatables: state.setAnimatables,
      createKeypoints: state.createKeypoints,
      updateFramerate: state.updateFramerate,
      setTimeDisplay: state.setTimeDisplay,
    })),
  );

  const updateDuration = usePlayerStore((state) => state.updateDuration);

  useEffect(() => {
    // Batch complex animation setup to prevent intermediate render states
    const initializeComplexData = () => {
      // Create more complex animation data for demonstration
      const complexAnimatables = {
        ...sharedAnimatables,
        "camera-position-z": {
          id: "camera-position-z",
          name: "Camera Position Z",
          type: "number" as const,
          default: 5,
          constraints: {
            min: 1,
            max: 20,
            velocity: 3,
          },
          pub: {
            public: true,
            output: "camera.position.z",
            units: "units",
          },
        },
        "object-color-r": {
          id: "object-color-r",
          name: "Object Color Red",
          type: "number" as const,
          default: 1,
          constraints: {
            min: 0,
            max: 1,
            velocity: 0.5,
          },
          pub: {
            public: true,
            output: "material.color.r",
            units: "color",
          },
        },
      };

      const complexTracks = {
        ...sharedTracks,
        "track-camera-z": {
          id: "track-camera-z",
          name: "Camera Z",
          animatableId: "camera-position-z",
          points: [],
          settings: {
            color: "#e17055",
          },
        },
        "track-color-r": {
          id: "track-color-r",
          name: "Color Red",
          animatableId: "object-color-r",
          points: [],
          settings: {
            color: "#fd79a8",
          },
        },
      };

      const complexAnimation = createComplexAnimation(complexTracks);

      // Set all core data together
      setAnimatables(complexAnimatables);
      setAnimations(complexAnimation);
      setTracks(complexTracks);

      // Set up namespace info immediately after core data
      const storeState = store.getState();
      if (storeState.namespaceInfo !== undefined) {
        Object.assign(storeState, { namespaceInfo: createNamespaceInfo("complex-animation") });
      }

      // Create keypoints after all structure is in place
      const complexKeypoints = [
        ...createKeypoints(),
        { trackId: "track-camera-z", keypoint: { id: "camera-1", stamp: 0, value: 5 } },
        {
          trackId: "track-camera-z",
          keypoint: { id: "camera-2", stamp: 2000, value: 15 },
        },
        { trackId: "track-camera-z", keypoint: { id: "camera-3", stamp: 4000, value: 8 } },
        { trackId: "track-camera-z", keypoint: { id: "camera-4", stamp: 6000, value: 12 } },
        { trackId: "track-camera-z", keypoint: { id: "camera-5", stamp: 8000, value: 5 } },
        { trackId: "track-color-r", keypoint: { id: "color-1", stamp: 0, value: 1 } },
        { trackId: "track-color-r", keypoint: { id: "color-2", stamp: 2000, value: 0.2 } },
        { trackId: "track-color-r", keypoint: { id: "color-3", stamp: 4000, value: 0.8 } },
        { trackId: "track-color-r", keypoint: { id: "color-4", stamp: 6000, value: 0.1 } },
        { trackId: "track-color-r", keypoint: { id: "color-5", stamp: 8000, value: 1 } },
      ];

      createKeypointsAction(complexKeypoints);

      // Finally update display settings
      updateFramerate(24);
      setTimeDisplay(TimeDisplay.Seconds);
      updateDuration(8000);
    };

    // Use setTimeout to ensure all state updates happen after current render cycle
    setTimeout(initializeComplexData, 0);
  }, [
    setAnimations,
    setTracks,
    setAnimatables,
    createKeypointsAction,
    updateFramerate,
    setTimeDisplay,
    updateDuration,
  ]);

  return (
    <div className="p-4">
      <AnimationSheet
        namespaceId="default"
        animationInstances={createAnimationInstances("complex-animation")}
        height={600}
      />
    </div>
  );
}

export const Default: Story = {
  args: {
    namespaceId: "default",
    animationInstances: createAnimationInstances(SHARED_ANIMATION_ID),
    storeInstance: createAnimationStore(),
  },
  render: () => {
    const [expanded, setExpanded] = useState(true);
    const collapsedHeight = 142; // MIN_SHEET_HEIGHT
    const expandedHeight = 400;

    const handleToggleExpand = useCallback((newExpanded: boolean) => {
      setExpanded(newExpanded);
    }, []);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleToggleExpand(!expanded)}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
          <span className="text-sm text-gray-600">
            Height: {expanded ? expandedHeight : collapsedHeight}px
          </span>
        </div>

        <AnimationSheetWithContext
          namespaceId="default"
          animationInstances={createAnimationInstances(SHARED_ANIMATION_ID)}
          height={expanded ? expandedHeight : collapsedHeight}
          onToggleExpand={handleToggleExpand}
          storeInstance={createAnimationStore()}
        />
      </div>
    );
  },
};

export const Expanded: Story = {
  args: {
    namespaceId: "default",
    animationInstances: createAnimationInstances(SHARED_ANIMATION_ID),
    height: 600,
    storeInstance: createAnimationStore(),
  },
};

export const Collapsed: Story = {
  args: {
    namespaceId: "default",
    animationInstances: createAnimationInstances(SHARED_ANIMATION_ID),
    height: 142, // MIN_SHEET_HEIGHT
    storeInstance: createAnimationStore(),
  },
};

export const Empty: Story = {
  args: {
    namespaceId: "default",
    animationInstances: {},
    height: 400,
    storeInstance: createAnimationStore(),
  },
};

const ComplexAnimation: Story = {
  args: {
    namespaceId: "default",
    animationInstances: createAnimationInstances("complex-animation"),
    height: 600,
  },
  render: () => (
    <AnimationContext.Provider value={createAnimationStore()}>
      <ComplexAnimationApp />
    </AnimationContext.Provider>
  ),
};

export { ComplexAnimation };
