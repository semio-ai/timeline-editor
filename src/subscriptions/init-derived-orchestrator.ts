import { shallow } from "zustand/shallow";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { DerivedSnapshot } from "../types";
import { buildDerivedSnapshot } from "../functions";
import { createTrackFeedbackProvider, type FeedbackProvider } from "../functions/feedback-provider";
import { logDerivedEvent } from "../utils/derived-debug";
import { projectRowVerticalAxes } from "./update-view-vertical-axes";
import { sealDerivedSnapshot } from "./seal-derived-snapshot";

export interface DerivedInputs {
  tracks: AnimationData["tracks"];
  animatables: AnimationData["animatables"];
  namespaces: AnimationData["namespaces"];
  animations: AnimationData["animations"];
  instancedTrackSources: AnimationData["instancedTrackSources"];
  dragState: AnimationData["dragState"];
  selectionState: AnimationData["selectionState"];
  editorViews: AnimationData["editorViews"];
  sourceRowIds: AnimationData["sourceRowIds"];
  sourceRowIdsByView: AnimationData["sourceRowIdsByView"];
  trackEvaluator: AnimationData["trackEvaluator"];
  feedbackProvider: AnimationData["feedbackProvider"];
}

export function selectDerivedInputs(state: AnimationData): DerivedInputs {
  return {
    tracks: state.tracks,
    animatables: state.animatables,
    namespaces: state.namespaces,
    animations: state.animations,
    instancedTrackSources: state.instancedTrackSources,
    dragState: state.dragState,
    selectionState: state.selectionState,
    editorViews: state.editorViews,
    sourceRowIds: state.sourceRowIds,
    sourceRowIdsByView: state.sourceRowIdsByView,
    trackEvaluator: state.trackEvaluator,
    feedbackProvider: state.feedbackProvider,
  };
}

/**
 * The derived snapshot for a set of inputs. Without a feedback provider every
 * violation is computed afresh; with one, the provider may answer from what it
 * computed before. Both give the same result.
 */
export function computeDerivedState(
  inputs: Omit<DerivedInputs, "feedbackProvider">,
  versionHint: number,
  feedbackProvider?: FeedbackProvider,
): DerivedSnapshot {
  const snapshot = buildDerivedSnapshot({
    tracks: inputs.tracks,
    namespaces: inputs.namespaces,
    animations: inputs.animations,
    animatables: inputs.animatables,
    instancedTrackSources: inputs.instancedTrackSources,
    dragState: inputs.dragState,
    selectionState: inputs.selectionState,
    trackEvaluator: inputs.trackEvaluator,
    feedbackProvider,
    version: versionHint,
  });

  const { rows: rowsWithAxes } = projectRowVerticalAxes(
    Object.fromEntries(Object.entries(snapshot.rows).map(([rowId, row]) => [rowId, row.computed])),
    inputs.editorViews,
    inputs.sourceRowIds,
    inputs.sourceRowIdsByView,
  );

  return {
    ...snapshot,
    rows: Object.fromEntries(
      Object.entries(snapshot.rows).map(([rowId, row]) => [
        rowId,
        {
          ...row,
          computed: rowsWithAxes[rowId] ?? row.computed,
        },
      ]),
    ),
  };
}

/**
 * How many times one outermost flush may build, nested flushes included. Each
 * publish is a write whose listeners may change an input again, and a provider
 * may report a change while it is being asked; a listener that answers every
 * snapshot with a new input would otherwise loop. Work left when the budget
 * runs out is picked up on a later task, so a long but finite chain of changes
 * still settles without holding up the write that started it.
 */
const MAX_SETTLE_PASSES = 8;

export interface DerivedOrchestrator {
  /** Listener to subscribe after every other subscription of the store. */
  writeSettled: () => void;
  /** Builds the first snapshot. Call once `writeSettled` is subscribed. */
  start: () => void;
  stop: () => void;
}

/**
 * Keeps `derivedSnapshot` current, building once per write.
 *
 * A write to the store notifies every listener, and the store's own
 * subscriptions answer some writes with writes of their own (a `tracks` write
 * rebuilds the source tree, which rebuilds `instancedTrackSources`, ...). Each
 * of those is a nested notification, run to completion inside the listener
 * that wrote it, and every nested notification visits every listener. So the
 * innermost notification is the first to finish, and when it does, every
 * subscription has seen the state as it now stands: any that wanted to answer
 * it has written, and that write was itself a deeper notification.
 *
 * `writeSettled` is subscribed after the store's own subscriptions, so it runs
 * last in each notification. It builds when the inputs differ from the ones
 * the current snapshot was built from. The innermost notification builds; the
 * enclosing ones find the inputs unchanged and do nothing. Building on every
 * input change instead would build once per nested write, each time from
 * inputs the next one replaces.
 *
 * Because the build happens at the end of the notification that settled the
 * inputs, a listener subscribed after the store's own (a host subscription, a
 * React hook) sees the new snapshot on the first notification that shows it
 * the new inputs, and a caller sees it as soon as its action returns.
 *
 * That holds for an action called from a listener too, including one
 * listening to the snapshot: its write is a nested notification, which builds
 * at its own end before the action returns. Publishing a snapshot does not
 * build again by itself, because the inputs are the ones just built from.
 */
export function createDerivedOrchestrator(
  _api: AnimationApi,
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
): DerivedOrchestrator {
  let started = false;
  let depth = 0;
  let passesLeft = 0;
  let building = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let providerChangedDuringBuild = false;
  let builtFrom: DerivedInputs | undefined;
  let watchedProvider: FeedbackProvider | undefined;
  let unwatchProvider: (() => void) | undefined;
  // Used when the host sets none: today's checks, cached per track.
  const defaultProvider = createTrackFeedbackProvider();

  const watchProvider = (provider: FeedbackProvider | undefined) => {
    if (provider === watchedProvider) return;
    unwatchProvider?.();
    unwatchProvider = undefined;
    watchedProvider = provider;
    // A provider whose answers change after it gave them (one that finishes a
    // check later) is a derived input changing: rebuild as a write would. If it
    // says so while a build is asking it, that build's answers are already out
    // of date, so the flush builds again.
    unwatchProvider = provider?.subscribe?.(() => {
      builtFrom = undefined;
      if (building) providerChangedDuringBuild = true;
      else flush();
    });
  };

  const build = (inputs: DerivedInputs) => {
    const versionHint = (get().derivedSnapshot?.version ?? 0) + 1;
    providerChangedDuringBuild = false;
    building = true;
    let snapshot: DerivedSnapshot;
    try {
      snapshot = computeDerivedState(
        inputs,
        versionHint,
        inputs.feedbackProvider ?? defaultProvider,
      );
    } finally {
      building = false;
    }
    builtFrom = providerChangedDuringBuild ? undefined : inputs;

    logDerivedEvent("derivedOrchestrator", "snapshot", () => ({
      version: snapshot.version,
      trackCount: Object.keys(snapshot.tracks).length,
      rowCount: Object.keys(snapshot.rows).length,
    }));

    set({ derivedSnapshot: sealDerivedSnapshot(snapshot) });
  };

  const scheduleRetry = () => {
    retry ??= setTimeout(() => {
      retry = undefined;
      flush();
    }, 0);
  };

  const flush = () => {
    if (!started) return;
    if (depth === 0) passesLeft = MAX_SETTLE_PASSES;
    depth += 1;
    try {
      for (;;) {
        const inputs = selectDerivedInputs(get());
        watchProvider(inputs.feedbackProvider);
        if (builtFrom && shallow(builtFrom, inputs)) return;
        if (passesLeft === 0) {
          scheduleRetry();
          return;
        }
        passesLeft -= 1;
        build(inputs);
      }
    } finally {
      depth -= 1;
    }
  };

  return {
    writeSettled: () => flush(),
    start: () => {
      started = true;
      builtFrom = undefined;
      flush();
    },
    stop: () => {
      started = false;
      clearTimeout(retry);
      retry = undefined;
      unwatchProvider?.();
      unwatchProvider = undefined;
      watchedProvider = undefined;
    },
  };
}

/**
 * Subscribes a derived orchestrator on its own. For one build per write,
 * subscribe its `writeSettled` after the store's other subscriptions, as
 * `initAnimationSubscriptions` does.
 */
export function initDerivedOrchestrator(
  api: AnimationApi,
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
): () => void {
  const orchestrator = createDerivedOrchestrator(api, set, get);
  const unsubscribe = api.subscribe(orchestrator.writeSettled);
  orchestrator.start();
  return () => {
    unsubscribe();
    orchestrator.stop();
  };
}
