import { RawValue, AnimatableValue } from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import type { Track, Animation, Namespace } from "../types";
import { createAnimationStore, type AnimationStore } from "../store";

// Animation IDs
export const ANIMATION_IDS = {
  SHARED: "shared-animation",
  NAMESPACE_A: "namespace-a-animation",
  NAMESPACE_B: "namespace-b-animation",
} as const;

// Namespace IDs
export const NAMESPACE_IDS = {
  ALPHA: "namespace-alpha",
  BETA: "namespace-beta",
} as const;

// Instance IDs
export const INSTANCE_IDS = {
  ALPHA_SHARED: "alpha-shared-instance",
  ALPHA_EXCLUSIVE: "alpha-exclusive-instance",
  BETA_SHARED: "beta-shared-instance",
  BETA_EXCLUSIVE: "beta-exclusive-instance",
} as const;

// Track IDs
export const TRACK_IDS = {
  // Shared animation tracks (vector3 position)
  POSITION: "position",
  SCALE: "scale",
  OPACITY: "opacity",

  // Namespace A tracks (euler rotation)
  ROTATION: "rotation",
  WIDTH: "width",
  HEIGHT: "height",

  // Namespace B tracks (vector3 translation)
  TRANSLATION: "translation",
  INTENSITY: "intensity",
  BLUR: "blur",
} as const;

// Animatable IDs
export const ANIMATABLE_IDS = {
  POSITION: "position",
  SCALE: "scale",
  OPACITY: "opacity",
  ROTATION: "rotation",
  WIDTH: "width",
  HEIGHT: "height",
  TRANSLATION: "translation",
  INTENSITY: "intensity",
  BLUR: "blur",
} as const;

/**
 * Create animatable value definitions
 */
function createAnimatables(): Record<string, AnimatableValue> {
  return {
    [ANIMATABLE_IDS.POSITION]: {
      id: ANIMATABLE_IDS.POSITION,
      name: "Position",
      type: "vector3",
      default: { x: 0, y: 0, z: 0 },
      constraints: {
        min: [-100, -100, -100],
        max: [100, 100, 100],
        velocity: 10,
      },
      pub: {
        public: true,
        output: "transform.position",
        units: "m",
        color: "#FF6B6B",
      },
    },
    [ANIMATABLE_IDS.SCALE]: {
      id: ANIMATABLE_IDS.SCALE,
      name: "Scale",
      type: "number",
      default: 1,
      constraints: {
        min: 0.1,
        max: 10,
        velocity: 2,
      },
      pub: {
        public: true,
        output: "transform.scale",
        units: "%",
        color: "#96CEB4",
      },
    },
    [ANIMATABLE_IDS.OPACITY]: {
      id: ANIMATABLE_IDS.OPACITY,
      name: "Opacity",
      type: "number",
      default: 1,
      constraints: {
        min: 0,
        max: 1,
        velocity: 1,
      },
      pub: {
        public: true,
        output: "material.opacity",
        units: "%",
        color: "#FFEAA7",
      },
    },
    [ANIMATABLE_IDS.ROTATION]: {
      id: ANIMATABLE_IDS.ROTATION,
      name: "Rotation",
      type: "euler",
      default: { r: 0, p: 0, y: 0 },
      constraints: {
        min: [-Math.PI, -Math.PI, -Math.PI],
        max: [Math.PI, Math.PI, Math.PI],
        velocity: 180,
      },
      pub: {
        public: true,
        output: "transform.rotation",
        units: "rad",
        color: "#E17055",
      },
    },
    [ANIMATABLE_IDS.WIDTH]: {
      id: ANIMATABLE_IDS.WIDTH,
      name: "Width",
      type: "number",
      default: 100,
      constraints: {
        min: 10,
        max: 500,
        velocity: 50,
      },
      pub: {
        public: true,
        output: "geometry.width",
        units: "m",
        color: "#FD79A8",
      },
    },
    [ANIMATABLE_IDS.HEIGHT]: {
      id: ANIMATABLE_IDS.HEIGHT,
      name: "Height",
      type: "number",
      default: 100,
      constraints: {
        min: 10,
        max: 500,
        velocity: 50,
      },
      pub: {
        public: true,
        output: "geometry.height",
        units: "m",
        color: "#FDCB6E",
      },
    },
    [ANIMATABLE_IDS.TRANSLATION]: {
      id: ANIMATABLE_IDS.TRANSLATION,
      name: "Translation",
      type: "vector3",
      default: { x: 0, y: 0, z: 0 },
      constraints: {
        min: [-200, -200, -200],
        max: [200, 200, 200],
        velocity: 20,
      },
      pub: {
        public: true,
        output: "transform.translation",
        units: "m",
        color: "#00B894",
      },
    },
    [ANIMATABLE_IDS.INTENSITY]: {
      id: ANIMATABLE_IDS.INTENSITY,
      name: "Intensity",
      type: "number",
      default: 0,
      constraints: {
        min: 0,
        max: 1,
        velocity: 0.5,
      },
      pub: {
        public: true,
        output: "effect.intensity",
        units: "%",
        color: "#FF7675",
      },
    },
    [ANIMATABLE_IDS.BLUR]: {
      id: ANIMATABLE_IDS.BLUR,
      name: "Blur",
      type: "number",
      default: 0,
      constraints: {
        min: 0,
        max: 20,
        velocity: 5,
      },
      pub: {
        public: true,
        output: "effect.blur",
        units: "px",
        color: "#FDCB6E",
      },
    },
  };
}

/**
 * Create tracks with keypoints
 */
function createTracks(): Record<string, Track<RawValue>> {
  return {
    // Shared animation tracks - Position (vector3)
    [TRACK_IDS.POSITION]: {
      id: TRACK_IDS.POSITION,
      name: "Position X",
      animatableId: ANIMATABLE_IDS.POSITION,
      points: [
        { id: "px0", stamp: 0, value: { x: 0, y: 0, z: 0 } },
        { id: "px1", stamp: 0.1, value: { x: 10, y: 20, z: -15 } },
        { id: "px2", stamp: 0.4, value: { x: 5, y: 10, z: 0 } },
        { id: "px3", stamp: 0.7, value: { x: -5, y: 5, z: 10 } },
        { id: "px4", stamp: 1, value: { x: 0, y: 0, z: 14 } },
      ],
      settings: { color: "#00FFFF" },
    },

    // Scale track - starts at 0.2, ends at 0.8 (partial range)
    [TRACK_IDS.SCALE]: {
      id: TRACK_IDS.SCALE,
      name: "Scale",
      animatableId: ANIMATABLE_IDS.SCALE,
      points: [
        { id: "s0", stamp: 0.2, value: 1 },
        { id: "s1", stamp: 0.4, value: 1.5 },
        { id: "s2", stamp: 0.5, value: 0.8 },
        { id: "s3", stamp: 0.8, value: 1 },
      ],
      settings: { color: "#96CEB4" },
    },

    // Opacity track - full range
    [TRACK_IDS.OPACITY]: {
      id: TRACK_IDS.OPACITY,
      name: "Opacity",
      animatableId: ANIMATABLE_IDS.OPACITY,
      points: [
        { id: "o0", stamp: 0, value: 0 },
        { id: "o1", stamp: 0.15, value: 1 },
        { id: "o2", stamp: 0.6, value: 1 },
        { id: "o3", stamp: 1, value: 0 },
      ],
      settings: { color: "#FFEAA7" },
    },

    // Namespace A tracks - Rotation (euler)
    [TRACK_IDS.ROTATION]: {
      id: TRACK_IDS.ROTATION,
      name: "Rotation X",
      animatableId: ANIMATABLE_IDS.ROTATION,
      points: [
        { id: "rx0", stamp: 0.1, value: { r: 0, p: Math.PI / 2, y: 0 } },
        { id: "rx1", stamp: 0.5, value: { r: -Math.PI / 4, p: Math.PI / 4, y: 0 } },
        { id: "rx2", stamp: 1, value: { r: -Math.PI / 2, p: 0, y: Math.PI / 4 } },
      ],
      settings: { color: "#E17055" },
    },

    // Width track - starts at 0, ends at 0.7 (partial range)
    [TRACK_IDS.WIDTH]: {
      id: TRACK_IDS.WIDTH,
      name: "Width",
      animatableId: ANIMATABLE_IDS.WIDTH,
      points: [
        { id: "w0", stamp: 0, value: 100 },
        { id: "w1", stamp: 0.3, value: 150 },
        { id: "w2", stamp: 0.75, value: 200 },
        { id: "w3", stamp: 0.9, value: 100 },
      ],
      settings: { color: "#FD79A8" },
    },

    // Height track - starts at 0.3, ends at 1 (partial range)
    [TRACK_IDS.HEIGHT]: {
      id: TRACK_IDS.HEIGHT,
      name: "Height",
      animatableId: ANIMATABLE_IDS.HEIGHT,
      points: [
        { id: "h0", stamp: 0.2, value: 50 },
        { id: "h1", stamp: 0.5, value: 100 },
        { id: "h2", stamp: 0.6, value: 75 },
        { id: "h3", stamp: 1, value: 50 },
      ],
      settings: { color: "#FDCB6E" },
    },

    // Namespace B tracks - Translation (vector3)
    [TRACK_IDS.TRANSLATION]: {
      id: TRACK_IDS.TRANSLATION,
      name: "Translation X",
      animatableId: ANIMATABLE_IDS.TRANSLATION,
      points: [
        { id: "tx0", stamp: 0.3, value: { x: -20, y: 0, z: 10 } },
        { id: "tx1", stamp: 0.5, value: { x: 0, y: -40, z: -50 } },
        { id: "tx2", stamp: 0.75, value: { x: 30, y: 30, z: 10 } },
      ],
      settings: { color: "#00B894" },
    },
    // Intensity track - full range
    [TRACK_IDS.INTENSITY]: {
      id: TRACK_IDS.INTENSITY,
      name: "Intensity",
      animatableId: ANIMATABLE_IDS.INTENSITY,
      points: [
        { id: "i0", stamp: 0, value: 0 },
        { id: "i1", stamp: 0.2, value: 0.5 },
        { id: "i2", stamp: 0.4, value: 1 },
        { id: "i3", stamp: 0.6, value: 0.7 },
        { id: "i4", stamp: 1, value: 0 },
      ],
      settings: { color: "#FF7675" },
    },

    // Blur track - starts at 0.4, ends at 0.95 (partial range)
    [TRACK_IDS.BLUR]: {
      id: TRACK_IDS.BLUR,
      name: "Blur",
      animatableId: ANIMATABLE_IDS.BLUR,
      points: [
        { id: "b0", stamp: 0.7, value: 0 },
        { id: "b1", stamp: 0.8, value: 10 },
        { id: "b2", stamp: 0.86, value: 5 },
        { id: "b3", stamp: 0.95, value: 0 },
      ],
      settings: { color: "#FDCB6E" },
    },
  };
}

/**
 * Create animation definitions
 */
function createAnimations(): Record<string, Animation> {
  return {
    [ANIMATION_IDS.SHARED]: {
      id: ANIMATION_IDS.SHARED,
      name: "Shared Animation",
      duration: 2000,
      tracks: [TRACK_IDS.POSITION, TRACK_IDS.SCALE, TRACK_IDS.OPACITY],
      groups: [],
    },
    [ANIMATION_IDS.NAMESPACE_A]: {
      id: ANIMATION_IDS.NAMESPACE_A,
      name: "Namespace A Animation",
      duration: 1500,
      tracks: [TRACK_IDS.ROTATION, TRACK_IDS.WIDTH, TRACK_IDS.HEIGHT],
      groups: [],
    },
    [ANIMATION_IDS.NAMESPACE_B]: {
      id: ANIMATION_IDS.NAMESPACE_B,
      name: "Namespace B Animation",
      duration: 3000,
      tracks: [TRACK_IDS.TRANSLATION, TRACK_IDS.INTENSITY, TRACK_IDS.BLUR],
      groups: [],
    },
  };
}

/**
 * Create namespace definitions with animation instances
 */
function createNamespaces(): Record<string, Namespace> {
  return {
    [NAMESPACE_IDS.ALPHA]: {
      id: NAMESPACE_IDS.ALPHA,
      name: "Namespace Alpha",
      animationInstances: {
        [INSTANCE_IDS.ALPHA_SHARED]: {
          id: INSTANCE_IDS.ALPHA_SHARED,
          animationId: ANIMATION_IDS.SHARED,
          settings: {
            active: true,
            offset: 0,
            timescale: 1,
          },
        },
        [INSTANCE_IDS.ALPHA_EXCLUSIVE]: {
          id: INSTANCE_IDS.ALPHA_EXCLUSIVE,
          animationId: ANIMATION_IDS.NAMESPACE_A,
          settings: {
            active: true,
            offset: 0,
            timescale: 1,
          },
        },
      },
    },
    [NAMESPACE_IDS.BETA]: {
      id: NAMESPACE_IDS.BETA,
      name: "Namespace Beta",
      animationInstances: {
        [INSTANCE_IDS.BETA_SHARED]: {
          id: INSTANCE_IDS.BETA_SHARED,
          animationId: ANIMATION_IDS.SHARED,
          settings: {
            active: true,
            offset: 0,
            timescale: 1,
          },
        },
        [INSTANCE_IDS.BETA_EXCLUSIVE]: {
          id: INSTANCE_IDS.BETA_EXCLUSIVE,
          animationId: ANIMATION_IDS.NAMESPACE_B,
          settings: {
            active: true,
            offset: 0,
            timescale: 1,
          },
        },
      },
    },
  };
}

/**
 * Create a complete test AnimationStore with all data
 * The store will initialize its subscriptions and compute derived data automatically
 */
export function createTestAnimationStore(options?: {
  includeNamespaceA?: boolean;
  includeNamespaceB?: boolean;
  activeInstance?: string;
}): AnimationStore {
  const {
    includeNamespaceA = true,
    includeNamespaceB = true,
    activeInstance = INSTANCE_IDS.ALPHA_SHARED,
  } = options || {};

  const allAnimatables = createAnimatables();
  const allTracks = createTracks();
  const allAnimations = createAnimations();
  const allNamespaces = createNamespaces();

  // Filter based on options
  const namespaces: Record<string, Namespace> = {};
  const animations: Record<string, Animation> = {};
  const tracks: Record<string, Track<RawValue>> = {};
  const animatables: Record<string, AnimatableValue> = {};

  if (includeNamespaceA) {
    namespaces[NAMESPACE_IDS.ALPHA] = allNamespaces[NAMESPACE_IDS.ALPHA];

    // Include shared animation and namespace A animation
    animations[ANIMATION_IDS.SHARED] = allAnimations[ANIMATION_IDS.SHARED];
    animations[ANIMATION_IDS.NAMESPACE_A] = allAnimations[ANIMATION_IDS.NAMESPACE_A];

    // Include relevant tracks
    [
      TRACK_IDS.POSITION,
      TRACK_IDS.SCALE,
      TRACK_IDS.OPACITY,
      TRACK_IDS.ROTATION,
      TRACK_IDS.WIDTH,
      TRACK_IDS.HEIGHT,
    ].forEach((id) => {
      tracks[id] = allTracks[id];
    });

    // Include relevant animatables
    [
      ANIMATABLE_IDS.POSITION,
      ANIMATABLE_IDS.SCALE,
      ANIMATABLE_IDS.OPACITY,
      ANIMATABLE_IDS.ROTATION,
      ANIMATABLE_IDS.WIDTH,
      ANIMATABLE_IDS.HEIGHT,
    ].forEach((id) => {
      animatables[id] = allAnimatables[id];
    });
  }

  if (includeNamespaceB) {
    namespaces[NAMESPACE_IDS.BETA] = allNamespaces[NAMESPACE_IDS.BETA];

    // Include shared animation if not already added
    if (!animations[ANIMATION_IDS.SHARED]) {
      animations[ANIMATION_IDS.SHARED] = allAnimations[ANIMATION_IDS.SHARED];
    }
    animations[ANIMATION_IDS.NAMESPACE_B] = allAnimations[ANIMATION_IDS.NAMESPACE_B];

    // Include relevant tracks
    [
      TRACK_IDS.POSITION,
      TRACK_IDS.SCALE,
      TRACK_IDS.OPACITY,
      TRACK_IDS.TRANSLATION,
      TRACK_IDS.INTENSITY,
      TRACK_IDS.BLUR,
    ].forEach((id) => {
      if (!tracks[id]) {
        tracks[id] = allTracks[id];
      }
    });

    // Include relevant animatables
    [
      ANIMATABLE_IDS.POSITION,
      ANIMATABLE_IDS.SCALE,
      ANIMATABLE_IDS.OPACITY,
      ANIMATABLE_IDS.TRANSLATION,
      ANIMATABLE_IDS.INTENSITY,
      ANIMATABLE_IDS.BLUR,
    ].forEach((id) => {
      if (!animatables[id]) {
        animatables[id] = allAnimatables[id];
      }
    });
  }

  // Create the store with initial data
  const store = createAnimationStore({
    // Core data
    animatables,
    animations,
    tracks,
    namespaces,

    // Active instance
    activeAnimationInstance: activeInstance,

    // Basic settings
    duration: 10000, // Will be computed from animations
    framerate: 30,
    timeDisplay: TimeDisplay.Frames,
    expanded: true,

    // Preferences
    preferences: {
      hoverDashedLine: true,
      dataPreviews: true,
    },
  });

  return store;
}

/**
 * Create a minimal AnimationStore for simple tests
 */
export function createMinimalAnimationStore(): AnimationStore {
  const store = createAnimationStore({
    animatables: {
      [ANIMATABLE_IDS.SCALE]: createAnimatables()[ANIMATABLE_IDS.SCALE],
    },
    animations: {
      minimal: {
        id: "minimal",
        name: "Minimal Animation",
        duration: 2000,
        tracks: [TRACK_IDS.SCALE],
        groups: [],
      },
    },
    tracks: {
      [TRACK_IDS.SCALE]: createTracks()[TRACK_IDS.SCALE],
    },
    namespaces: {
      default: {
        id: "default",
        name: "Default",
        animationInstances: {
          main: {
            id: "main",
            animationId: "minimal",
            settings: {
              active: true,
              offset: 0,
              timescale: 1,
            },
          },
        },
      },
    },
    activeAnimationInstance: "main",
    duration: 2000,
    framerate: 30,
    timeDisplay: TimeDisplay.Frames,
    expanded: true,
    preferences: {
      hoverDashedLine: true,
      dataPreviews: true,
    },
  });

  return store;
}

/**
 * Get all marker paths for a given instance and track
 * Useful for testing selection
 */
export function getMarkerPaths(namespaceId: string, instanceId: string, trackId: string): string[] {
  const tracks = createTracks();
  const track = tracks[trackId];
  if (!track) return [];

  return track.points.map((point) => `${namespaceId}/${instanceId}/${trackId}#${point.id}`);
}

/**
 * Export helper functions for external use
 */
export { createAnimatables, createTracks, createAnimations, createNamespaces };
