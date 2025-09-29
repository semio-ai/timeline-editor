import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useContext, useMemo, useCallback, type ReactNode } from "react";
import useMeasure from "react-use-measure";
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
  createNamespaceInfo,
  createComplexAnimation,
  singleTrackAnimatables,
  singleTrackTracks,
  getSingleTrackAnimation,
  createSingleTrackKeypoints,
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
  onToggleExpand,
  height,
  storeInstance,
}: AnimationSheetWithContextProps): ReactNode {
  const store = storeInstance || createAnimationStore();

  return (
    <AnimationContext.Provider value={store}>
      <AppWithAnimation onToggleExpand={onToggleExpand} height={height} />
    </AnimationContext.Provider>
  );
}

function AppWithAnimation({ onToggleExpand, height }: AnimationSheetProps): ReactNode {
  const store = useContext(AnimationContext);

  if (!store) {
    throw new Error("AnimationContext must be provided");
  }

  const {
    setAnimations,
    setTracks,
    setAnimatables,
    setNamespaces,
    createKeypoints: createKeypointsAction,
    updateFramerate,
    setTimeDisplay,
  } = store(
    useShallow((state) => ({
      setAnimations: state.setAnimations,
      setTracks: state.setTracks,
      setAnimatables: state.setAnimatables,
      setNamespaces: state.setNamespaces,
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

      // Set up namespace with proper structure
      setNamespaces({
        default: {
          id: "default",
          name: "Default Namespace",
          animationInstances: {
            "instance-1": {
              id: "instance-1",
              animationId: SHARED_ANIMATION_ID,
              settings: {
                active: true,
                offset: 0,
                timescale: 1,
              },
            },
          },
        },
      });

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
    setNamespaces,
    createKeypointsAction,
    updateFramerate,
    setTimeDisplay,
    updateDuration,
  ]);

  return (
    <AnimationSheet
      onToggleExpand={onToggleExpand}
      height={height}
      fonts={{
        mono: "fonts/roboto-mono-regular.ttf",
        ui: "fonts/roboto-regular.ttf",
      }}
    />
  );
}

function SingleTrackApp(): ReactNode {
  const store = useContext(AnimationContext);

  if (!store) {
    throw new Error("AnimationContext must be provided");
  }

  const {
    setAnimations,
    setTracks,
    setAnimatables,
    setNamespaces,
    createKeypoints: createKeypointsAction,
    updateFramerate,
    setTimeDisplay,
  } = store(
    useShallow((state) => ({
      setAnimations: state.setAnimations,
      setTracks: state.setTracks,
      setAnimatables: state.setAnimatables,
      setNamespaces: state.setNamespaces,
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
      setAnimatables(singleTrackAnimatables);
      setAnimations(getSingleTrackAnimation());
      setTracks(singleTrackTracks);

      // Set up namespace with proper structure
      setNamespaces({
        default: {
          id: "default",
          name: "Default Namespace",
          animationInstances: {
            "instance-1": {
              id: "instance-1",
              animationId: SHARED_ANIMATION_ID,
              settings: {
                active: true,
                offset: 0,
                timescale: 1,
              },
            },
          },
        },
      });

      // Create keyframes after all structure is in place
      const keypoints = createSingleTrackKeypoints();
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
    setNamespaces,
    createKeypointsAction,
    updateFramerate,
    setTimeDisplay,
    updateDuration,
  ]);

  return (
    <AnimationSheet
      onToggleExpand={() => {}}
      height={400}
      fonts={{
        mono: "fonts/roboto-mono-regular.ttf",
        ui: "fonts/roboto-regular.ttf",
      }}
    />
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
    setNamespaces,
    createKeypoints: createKeypointsAction,
    updateFramerate,
    setTimeDisplay,
  } = store(
    useShallow((state) => ({
      setAnimations: state.setAnimations,
      setTracks: state.setTracks,
      setAnimatables: state.setAnimatables,
      setNamespaces: state.setNamespaces,
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

      // Set up namespace with proper structure
      setNamespaces({
        default: {
          id: "default",
          name: "Default Namespace",
          animationInstances: {
            "instance-1": {
              id: "instance-1",
              animationId: "complex-animation",
              settings: {
                active: true,
                offset: 0,
                timescale: 1,
              },
            },
          },
        },
      });

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
    setNamespaces,
    createKeypointsAction,
    updateFramerate,
    setTimeDisplay,
    updateDuration,
  ]);

  return (
    <div className="p-4">
      <AnimationSheet
        height={600}
        fonts={{
          mono: "fonts/roboto-mono-regular.ttf",
          ui: "fonts/roboto-regular.ttf",
        }}
      />
    </div>
  );
}

export const Default: Story = {
  args: {
    storeInstance: createAnimationStore(),
  },
  render: (_) => {
    const [ref, bounds] = useMeasure();
    const minHeight = 142;
    const height = Math.max(bounds.height, minHeight);

    // Memoize stable props to prevent re-initialization on resize
    const storeInstance = useMemo(() => createAnimationStore(), []);
    const onToggleExpand = useCallback(() => {}, []);
    const fonts = useMemo(
      () => ({
        mono: "fonts/roboto-mono-regular.ttf",
        ui: "fonts/roboto-regular.ttf",
      }),
      [],
    );

    return (
      <div ref={ref} style={{ width: "100vw", height: "100vh", minHeight, overflow: "hidden" }}>
        <AnimationSheetWithContext
          height={height}
          onToggleExpand={onToggleExpand}
          storeInstance={storeInstance}
          fonts={fonts}
        />
      </div>
    );
  },
};

export const Expanded: Story = {
  args: {
    height: 600,
    storeInstance: createAnimationStore(),
    fonts: {
      mono: "fonts/roboto-mono-regular.ttf",
      ui: "fonts/roboto-regular.ttf",
    },
  },
};

export const Collapsed: Story = {
  args: {
    height: 142, // MIN_SHEET_HEIGHT
    storeInstance: createAnimationStore(),
    fonts: {
      mono: "fonts/roboto-mono-regular.ttf",
      ui: "fonts/roboto-regular.ttf",
    },
  },
};

export const Empty: Story = {
  args: {
    height: 400,
    storeInstance: createAnimationStore(),
    fonts: {
      mono: "fonts/roboto-mono-regular.ttf",
      ui: "fonts/roboto-regular.ttf",
    },
  },
};

export const SingleTrack: Story = {
  args: {
    height: 400,
  },
  render: () => (
    <AnimationContext.Provider value={createAnimationStore()}>
      <SingleTrackApp />
    </AnimationContext.Provider>
  ),
};

const ComplexAnimation: Story = {
  args: {
    height: 600,
  },
  render: () => (
    <AnimationContext.Provider value={createAnimationStore()}>
      <ComplexAnimationApp />
    </AnimationContext.Provider>
  ),
};

export { ComplexAnimation };

export const Resizable: Story = {
  args: {
    height: 400,
  },
  render: () => {
    const [ref, bounds] = useMeasure();
    const minHeight = 200;
    const height = Math.max(bounds.height, minHeight);

    // Memoize all stable props to prevent re-initialization on resize
    const storeInstance = useMemo(() => createAnimationStore(), []);
    const onToggleExpand = useCallback(() => {}, []);
    const fonts = useMemo(
      () => ({
        mono: "fonts/roboto-mono-regular.ttf",
        ui: "fonts/roboto-regular.ttf",
      }),
      [],
    );

    return (
      <div
        ref={ref}
        style={{
          width: "100vw",
          height: "100vh",
          minHeight,
          resize: "both",
          overflow: "auto",
          border: "2px solid #ccc",
        }}
      >
        <AnimationSheetWithContext
          height={height}
          onToggleExpand={onToggleExpand}
          storeInstance={storeInstance}
          fonts={fonts}
        />
      </div>
    );
  },
};

export const Debug: Story = {
  args: {
    height: 400,
  },
  render: () => {
    const [ref, bounds] = useMeasure();
    const minHeight = 200;
    const height = Math.max(bounds.height, minHeight);

    // Memoize all stable props to prevent re-initialization on resize
    const storeInstance = useMemo(() => createAnimationStore(), []);
    const onToggleExpand = useCallback(() => {}, []);
    const fonts = useMemo(
      () => ({
        mono: "fonts/roboto-mono-regular.ttf",
        ui: "fonts/roboto-regular.ttf",
      }),
      [],
    );

    return (
      <div
        style={{
          position: "relative",
          width: "100vw",
          height: "100vh",
          minHeight,
          overflow: "hidden",
        }}
      >
        {/* Debug info overlay */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            background: "rgba(0, 0, 0, 0.8)",
            color: "white",
            padding: "8px 12px",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "12px",
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          <div>
            Container: {Math.round(bounds.width)}×{Math.round(bounds.height)}
          </div>
          <div>Sheet Height: {height}</div>
          <div>Min Height: {minHeight}</div>
        </div>

        <div
          ref={ref}
          style={{
            width: "100%",
            height: "100%",
            resize: "both",
            overflow: "auto",
            border: "2px solid #666",
          }}
        >
          <AnimationSheetWithContext
            height={height}
            onToggleExpand={onToggleExpand}
            storeInstance={storeInstance}
            fonts={fonts}
          />
        </div>
      </div>
    );
  },
};
