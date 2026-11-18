import { isDraft, original } from "immer";
import { shallow } from "zustand/shallow";
import { isEqual } from "lodash";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { DerivedSnapshot } from "../types";
import { buildDerivedSnapshotWithRows } from "../functions/build-derived-snapshot";
import { recordReusableRows, reusableRowsOf } from "../functions/row-reuse";
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
 * computed before. Given the snapshot this store published last, rows whose
 * inputs did not change are handed on from it, as the same objects. Each of
 * these gives the same result as a build from nothing.
 */
export function computeDerivedState(
  inputs: Omit<DerivedInputs, "feedbackProvider">,
  versionHint: number,
  feedbackProvider?: FeedbackProvider,
  previous?: DerivedSnapshot,
): DerivedSnapshot {
  const previousRows = reusableRowsOf(previous);
  const { snapshot, rows: reusableRows } = buildDerivedSnapshotWithRows({
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
    previousRows,
  });

  const { rows: rowsWithAxes } = projectRowVerticalAxes(
    Object.fromEntries(Object.entries(snapshot.rows).map(([rowId, row]) => [rowId, row.computed])),
    inputs.editorViews,
    inputs.sourceRowIds,
    inputs.sourceRowIdsByView,
  );

  const derived: DerivedSnapshot = {
    ...snapshot,
    rows: Object.fromEntries(
      Object.entries(snapshot.rows).map(([rowId, row]) => {
        const computed = rowsWithAxes[rowId] ?? row.computed;
        // A reused row whose axes came out the same keeps its published
        // object, so a renderer comparing rows by identity skips it.
        const published = previous?.rows[rowId];
        if (
          published &&
          previousRows?.get(rowId)?.row === row &&
          isEqual(published.computed.verticalAxisByView, computed.verticalAxisByView)
        ) {
          return [rowId, published];
        }
        return [rowId, { ...row, computed }];
      }),
    ),
  };
  recordReusableRows(derived, reusableRows);
  return derived;
}

// The inputs each published snapshot was built from.
const inputsOfSnapshot = new WeakMap<DerivedSnapshot, DerivedInputs>();

/**
 * The derived snapshot for `state`'s own inputs: the published one when it
 * was built from them, and otherwise one built now, without publishing it.
 *
 * The published snapshot trails its inputs while building is stalled, and an
 * action may run then. An action whose effect outlasts the snapshot (committing
 * a drag writes the keys it projected) reads through this, so what it writes
 * never comes from inputs it no longer has, however a refresh before it fared.
 * Building without publishing runs no listener, so nothing can change the
 * inputs between this and the action's use of it. Its violations come from the
 * editor's own checks, not the host's provider: none of these actions reads
 * them, and asking a provider from inside an action would let it write.
 *
 * Given an Immer draft, it reads the state the recipe started from.
 */
export function currentDerivedSnapshot(state: AnimationData): DerivedSnapshot | undefined {
  const base = isDraft(state) ? original(state)! : state;
  const published = base.derivedSnapshot;
  // No subscriptions have built one, so there is nothing derived to act on.
  if (!published) return undefined;
  const inputs = selectDerivedInputs(base);
  const builtFrom = inputsOfSnapshot.get(published);
  if (builtFrom && shallow(withoutProvider(builtFrom), withoutProvider(inputs))) return published;
  return computeDerivedState(inputs, published.version ?? 0, undefined, published);
}

const withoutProvider = ({ feedbackProvider: _provider, ...rest }: DerivedInputs) => rest;

/**
 * How many times one outermost flush may build, nested flushes included. Each
 * publish is a write whose listeners may change an input again, and a provider
 * may report a change while it is being asked; a listener that answers every
 * snapshot with a new input would otherwise loop.
 *
 * When the budget runs out, building stops for the rest of the task: the
 * notifications still unwinding from the write would otherwise each start a
 * flush with a budget of its own. A later task flushes again with a fresh
 * budget, so every change, including an edit made while building was
 * stopped, is shown in the end: dropping the leftover work would leave the
 * snapshot behind its inputs until some unrelated write.
 *
 * The first retry runs on the next task, so a chain that needs up to twice
 * this many builds, the first included, settles at once. Each further retry
 * in the same unsettled chain waits twice as long as the one before, up to
 * `MAX_RETRY_DELAY_MS`: inputs that never settle (a listener answering every
 * snapshot with a new edit) cost one budget per delay instead of a loop.
 */
const MAX_SETTLE_PASSES = 8;
const FIRST_BACKOFF_MS = 50;
const MAX_RETRY_DELAY_MS = 1000;

/** How long the `stalls`-th stall of one unsettled chain waits to retry. */
export function retryDelay(stalls: number): number {
  if (stalls <= 1) return 0;
  return Math.min(MAX_RETRY_DELAY_MS, FIRST_BACKOFF_MS * 2 ** (stalls - 2));
}

export interface DerivedOrchestrator {
  /** Listener to subscribe after every other subscription of the store. */
  writeSettled: () => void;
  /** Builds the first snapshot. Call once `writeSettled` is subscribed. */
  start: () => void;
  stop: () => void;
  /**
   * Builds at once if building is stalled and the snapshot trails its inputs,
   * until the snapshot was published from the inputs as they stand, within
   * one budget. Otherwise the snapshot is already current wherever an action
   * runs, and this does nothing.
   *
   * It does not build inside a running build (an action a provider calls
   * while it is asked) or inside a refresh (an action a listener calls in
   * answer to the refresh's own publish): either would let a provider or
   * listener that never settles recurse once per build. Such an action reads
   * the snapshot as it stands.
   */
  refresh: () => void;
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
 *
 * A write made while a build is running (a provider that writes to the store
 * while it is being asked) does not build inside it: the running build owns
 * the record of what it was built from, and a nested build would overwrite it.
 * The running build is then discarded rather than published, because it was
 * built from inputs the store no longer holds, and the flush builds again
 * from the new ones. The nested write's own notification still runs before
 * that rebuild, so its listeners see the new inputs beside the previous
 * snapshot, as they would in any write's notification before it settles.
 *
 * While building is stalled, the snapshot can trail its inputs. An action
 * that reads the snapshot calls `refresh` first, so it acts on a snapshot
 * built from its own inputs: committing a drag, for one, applies the pending
 * changes the snapshot projected for where the drag now is. `refresh` says
 * where it cannot.
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
  // Set when the budget runs out; no flush builds until the retry runs.
  let stalled = false;
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  // How many times the budget has run out since an outermost flush last settled.
  let stalls = 0;
  let providerChangedDuringBuild = false;
  let builtFrom: DerivedInputs | undefined;
  let watchedProvider: FeedbackProvider | undefined;
  let unwatchProvider: (() => void) | undefined;
  // Counts watches; a listener or handle from an earlier one is ignored.
  let watch = 0;
  // Used when the host sets none: today's checks, cached per track.
  const defaultProvider = createTrackFeedbackProvider();

  const watchProvider = (provider: FeedbackProvider | undefined) => {
    if (provider === watchedProvider) return;
    unwatchProvider?.();
    unwatchProvider = undefined;
    watchedProvider = provider;
    // Each watch is its own, even of a provider watched before: the same
    // provider can be replaced and set again while it is still subscribing.
    watch += 1;
    const thisWatch = watch;
    // A provider whose answers change after it gave them (one that finishes a
    // check later) is a derived input changing: rebuild as a write would. If it
    // says so while a build is asking it, that build's answers are already out
    // of date, so the flush builds again.
    if (!provider?.subscribe) return;
    const unwatch = provider.subscribe(() => {
      if (watch !== thisWatch) return;
      builtFrom = undefined;
      if (building) providerChangedDuringBuild = true;
      else flush();
    });
    // A provider may answer from inside `subscribe`, and what that answer sets
    // off (a build whose listener stops the store or sets another provider)
    // can end this watch before its handle is returned. A handle for a watch
    // that has already ended is released at once, rather than kept where
    // nothing will release it or where it would replace the newer watch's.
    if (watch === thisWatch) unwatchProvider = unwatch;
    else unwatch();
  };

  /** Builds from `inputs` and publishes, unless the result is out of date before it can be. */
  const build = (inputs: DerivedInputs): boolean => {
    const versionHint = (get().derivedSnapshot?.version ?? 0) + 1;
    providerChangedDuringBuild = false;
    building = true;
    let snapshot: DerivedSnapshot;
    try {
      snapshot = computeDerivedState(
        inputs,
        versionHint,
        inputs.feedbackProvider ?? defaultProvider,
        get().derivedSnapshot,
      );
    } finally {
      building = false;
    }
    // Stopped while asking the provider: a stopped orchestrator publishes nothing.
    if (!started) return false;
    // A write made while building replaced the inputs this was built from;
    // publishing it would show listeners a snapshot of a state the store no
    // longer holds. The flush that called this builds again from the new ones.
    if (!shallow(inputs, selectDerivedInputs(get()))) {
      builtFrom = undefined;
      return false;
    }
    builtFrom = providerChangedDuringBuild ? undefined : inputs;

    logDerivedEvent("derivedOrchestrator", "snapshot", () => ({
      version: snapshot.version,
      trackCount: Object.keys(snapshot.tracks).length,
      rowCount: Object.keys(snapshot.rows).length,
    }));

    const sealed = sealDerivedSnapshot(snapshot);
    inputsOfSnapshot.set(sealed, inputs);
    set({ derivedSnapshot: sealed });
    return true;
  };

  const stall = () => {
    if (stalled) return;
    stalled = true;
    stalls += 1;
    const delay = retryDelay(stalls);
    logDerivedEvent("derivedOrchestrator", "settle budget exhausted", () => ({ stalls, delay }));
    stallTimer = setTimeout(() => {
      stallTimer = undefined;
      stalled = false;
      flush();
    }, delay);
  };

  const flush = () => {
    if (!started || building || stalled) return;
    if (depth === 0) passesLeft = MAX_SETTLE_PASSES;
    depth += 1;
    try {
      for (;;) {
        // A listener of the last publish may have stopped this orchestrator.
        if (!started) return;
        const inputs = selectDerivedInputs(get());
        watchProvider(inputs.feedbackProvider);
        if (builtFrom && shallow(builtFrom, inputs)) {
          // Only an outermost flush settling ends a chain of changes: a nested
          // one finds the inputs already built by a deeper flush.
          if (depth === 1) stalls = 0;
          return;
        }
        if (passesLeft === 0) {
          stall();
          return;
        }
        passesLeft -= 1;
        build(inputs);
      }
    } finally {
      depth -= 1;
    }
  };

  let refreshing = false;
  const refresh = () => {
    if (!started || building || !stalled || refreshing) return;
    refreshing = true;
    try {
      // The inputs of the last snapshot this refresh published.
      let published: DerivedInputs | undefined;
      // Until the snapshot was published from the inputs as they stand, within
      // one budget. A write made while building drops the build it overtook,
      // and a listener answering the publish (one cancelling the drag the
      // action is about to commit) changes the inputs again. A provider whose
      // answer changed while it was asked does not count: the snapshot
      // already projects the drag and selection the action reads.
      for (let pass = 0; pass < MAX_SETTLE_PASSES; pass += 1) {
        if (!started) return;
        const inputs = selectDerivedInputs(get());
        // Watched before it is asked, so an answer it gives late reaches the
        // retry, which would otherwise find these inputs already built.
        watchProvider(inputs.feedbackProvider);
        if (builtFrom && shallow(builtFrom, inputs)) return;
        if (published && shallow(published, inputs)) return;
        // The publish notifies `writeSettled`, which finds building stalled;
        // the pending retry still runs.
        if (build(inputs)) published = inputs;
      }
    } finally {
      refreshing = false;
    }
  };

  return {
    writeSettled: () => flush(),
    refresh,
    start: () => {
      started = true;
      builtFrom = undefined;
      flush();
    },
    stop: () => {
      started = false;
      clearTimeout(stallTimer);
      stallTimer = undefined;
      stalled = false;
      unwatchProvider?.();
      unwatchProvider = undefined;
      watchedProvider = undefined;
      watch += 1;
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
