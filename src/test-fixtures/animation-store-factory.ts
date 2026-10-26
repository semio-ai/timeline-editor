import { AnimatableValue, DeprecatedComplexAnimatableValue, namespaceEntity } from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import {
  type Namespace,
  TransitionPairing,
  StoredAnimation,
  StandardTransitionType,
} from "../types";
import { ControlStripMode, HandleVisibility, ViolationVisibility } from "../store-types";
import { createAnimationStore, type AnimationStore } from "../store";
import { migrateAnimationData } from "../functions/migrate-animation-data";
import { migrateToMillisecondStamps } from "../functions/migrate-animation-format";
import type { TrackEvaluator } from "../functions/track-curve";

import {
  ANIMATION_IDS,
  NAMESPACE_IDS,
  INSTANCE_IDS,
  TRACK_IDS,
  ANIMATABLE_IDS,
  createAnimatables,
  createTracks,
  createAnimations,
  createNamespaces,
} from "./animation-data";

export {
  ANIMATION_IDS,
  NAMESPACE_IDS,
  INSTANCE_IDS,
  TRACK_IDS,
  ANIMATABLE_IDS,
} from "./animation-data";

function migrateAnimationSet(
  animations: Record<string, StoredAnimation>,
  animatables: Record<string, AnimatableValue | DeprecatedComplexAnimatableValue>,
): { animations: Record<string, StoredAnimation>; animatables: Record<string, AnimatableValue> } {
  return Object.values(animations).reduce(
    (acc, animation) => {
      // First migrate composite tracks to scalar tracks
      const migrated = migrateAnimationData(animation, animatables);
      // Then migrate from v1 normalized stamps to v2 millisecond stamps
      const v2 = migrateToMillisecondStamps(migrated.animation);
      acc.animations[v2.id] = v2;
      acc.animatables = { ...acc.animatables, ...migrated.animatables };
      return acc;
    },
    {
      animations: {} as Record<string, StoredAnimation>,
      animatables: {} as Record<string, AnimatableValue>,
    },
  );
}

/**
 * Create a complete test AnimationStore with all data
 * The store will initialize its subscriptions and compute derived data automatically
 */
export function createTestAnimationStore(options?: {
  includeNamespaceA?: boolean;
  includeNamespaceB?: boolean;
  activeInstance?: string;
  /** What evaluates the tracks' curves; without one no track has a curve. */
  trackEvaluator?: TrackEvaluator;
}): AnimationStore {
  const {
    includeNamespaceA = true,
    includeNamespaceB = true,
    activeInstance = INSTANCE_IDS.ALPHA_SHARED,
    trackEvaluator,
  } = options || {};

  const allAnimatables = createAnimatables();
  const allTracks = createTracks();
  const allAnimations = createAnimations(allTracks);
  const allNamespaces = createNamespaces();

  // Filter based on options
  const namespaces: Record<string, Namespace> = {};
  const animations: Record<string, StoredAnimation> = {};
  const animatables: Record<string, AnimatableValue | DeprecatedComplexAnimatableValue> = {};

  if (includeNamespaceA) {
    namespaces[NAMESPACE_IDS.ALPHA] = allNamespaces[NAMESPACE_IDS.ALPHA];

    // Include shared animation and namespace A animation
    animations[ANIMATION_IDS.SHARED] = allAnimations[ANIMATION_IDS.SHARED];
    animations[ANIMATION_IDS.NAMESPACE_A] = allAnimations[ANIMATION_IDS.NAMESPACE_A];

    // Include relevant animatables
    [
      ANIMATABLE_IDS.UNLISTED,
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

    // Include relevant animatables
    [
      ANIMATABLE_IDS.UNLISTED,
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

  const { animations: migratedAnimations, animatables: migratedAnimatables } = migrateAnimationSet(
    animations,
    animatables,
  );

  const store = createAnimationStore({
    trackEvaluator,
    framerate: 30,
    timeDisplay: TimeDisplay.Frames,
    expanded: true,

    // Preferences
    preferences: {
      controlStripMode: ControlStripMode.KeySkip,
      handleVisibility: HandleVisibility.TrackSelection,
      violationVisibility: ViolationVisibility.Visible,
      newKeyDefaults: {
        transitions: {
          in: StandardTransitionType.Cubic,
          out: StandardTransitionType.Cubic,
          pairing: TransitionPairing.Paired,
        },
      },
    },
  });

  const setNamespaces = store.getState().setNamespaces;
  const setAnimatables = store.getState().setAnimatables;
  const setAnimations = store.getState().setAnimations;
  const setEntityControlMode = store.getState().setEntityControlMode;
  const setActiveEntity = store.getState().setActiveEntity;
  const focusSelectionInstance = store.getState().focusSelectionInstance;

  // Set animatables and namespaces first
  setAnimatables(migratedAnimatables);
  setAnimations(migratedAnimations);
  setNamespaces(namespaces);

  // Seed entityStates so canvas/track-list "active instance" derivations
  // (which read from entityStates, not from selectionState.instanceId)
  // see the fixture's intended active instance for each namespace's
  // owning entity. The namespaceId IS the entityId in these fixtures
  // (it names no instance).
  Object.keys(namespaces).forEach((namespaceId) => {
    const entityId = namespaceEntity(namespaceId);
    setEntityControlMode(entityId, "animation", activeInstance);
  });

  // Focus on the entity that owns `activeInstance`. The "actually
  // editable" foreground layer requires isFocusedEntity match — without
  // this, every test track would render in the locked layer and
  // selection-driven assertions would silently mismatch.
  const owningNamespaceId = Object.entries(namespaces).find(([, namespace]) =>
    Object.keys(namespace.animationInstances).includes(activeInstance),
  )?.[0];
  if (owningNamespaceId) {
    setActiveEntity(namespaceEntity(owningNamespaceId));
  }

  focusSelectionInstance(activeInstance);

  return store;
}

/**
 * Create a minimal AnimationStore for simple tests
 */
export function createMinimalAnimationStore(options?: {
  /** What evaluates the tracks' curves; without one no track has a curve. */
  trackEvaluator?: TrackEvaluator;
}): AnimationStore {
  const animatables = createAnimatables();
  const tracks = createTracks();
  const store = createAnimationStore({
    trackEvaluator: options?.trackEvaluator,
    framerate: 30,
    timeDisplay: TimeDisplay.Frames,
    expanded: true,
    preferences: {
      controlStripMode: ControlStripMode.KeySkip,
      handleVisibility: HandleVisibility.TrackSelection,
      violationVisibility: ViolationVisibility.Visible,
      newKeyDefaults: {
        transitions: {
          in: StandardTransitionType.Cubic,
          out: StandardTransitionType.Cubic,
          pairing: TransitionPairing.Paired,
        },
      },
    },
  });

  const setAnimatables = store.getState().setAnimatables;
  const setAnimations = store.getState().setAnimations;
  const setNamespaces = store.getState().setNamespaces;
  const setEntityControlMode = store.getState().setEntityControlMode;
  const setActiveEntity = store.getState().setActiveEntity;
  const focusSelectionInstance = store.getState().focusSelectionInstance;

  const { animations: migratedAnimations, animatables: migratedAnimatables } = migrateAnimationSet(
    {
      minimal: {
        id: "minimal",
        name: "Minimal Animation",
        duration: 2000,
        tracks: [tracks[TRACK_IDS.SCALE]],
        groups: [],
      },
    },
    {
      [ANIMATABLE_IDS.SCALE]: animatables[ANIMATABLE_IDS.SCALE],
    },
  );
  setAnimatables(migratedAnimatables);
  setAnimations(migratedAnimations);
  setNamespaces({
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
  });
  setEntityControlMode("default", "animation", "main");
  setActiveEntity("default");
  focusSelectionInstance("main");

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
