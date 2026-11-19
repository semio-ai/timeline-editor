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
// The last snapshot built for an action while a published one trailed.
const builtForAction = new WeakMap<
  DerivedSnapshot,
  { inputs: DerivedInputs; snapshot: DerivedSnapshot }
>();

/**
 * The derived snapshot for `state`'s own inputs, for an action to read: the
 * published one when it was built from them, and otherwise one built now and
 * not published.
 *
 * The published snapshot is current wherever an action runs, except while
 * building is stalled (see `createDerivedOrchestrator`) or in the middle of a
 * write the store's own subscriptions are still answering, as when a host or
 * player listener acts then. An action reading the published one there would
 * act on inputs the state no longer has: a skip lands on a key that has moved,
 * a commit writes where the drag used to be. Every action that reads derived
 * data reads it through this instead.
 *
 * A snapshot built here is not published: publishing would notify listeners,
 * which could change the state between this and the action's use of it, and
 * in the middle of a write it would show them a snapshot of half-updated
 * inputs. The published snapshot catches up when building resumes. Its
 * violations come from the editor's own checks, not the host's provider: no
 * action reads them, and asking a provider from inside an action would let it
 * write. Asked again for the same inputs, it answers with the snapshot it
 * built before.
 *
 * Given an Immer draft, it reads the state the recipe started from.
 */
export function currentDerivedSnapshot(state: AnimationData): DerivedSnapshot | undefined {
  const base = isDraft(state) ? original(state)! : state;
  const published = base.derivedSnapshot;
  // No subscriptions have built one, so there is nothing derived to act on.
  if (!published) return undefined;
  const inputs = withoutProvider(selectDerivedInputs(base));
  const builtFrom = inputsOfSnapshot.get(published);
  if (builtFrom && shallow(withoutProvider(builtFrom), inputs)) return published;
  const built = builtForAction.get(published);
  if (built && shallow(built.inputs, inputs)) return built.snapshot;
  const snapshot = computeDerivedState(inputs, published.version ?? 0, undefined, published);
  builtForAction.set(published, { inputs, snapshot });
  return snapshot;
}

const withoutProvider = ({
  feedbackProvider: _provider,
  ...rest
}: DerivedInputs): DerivedInputs => ({ ...rest, feedbackProvider: undefined });

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
 * While building is stalled, the snapshot can trail its inputs until the
 * retry. Actions read derived data through `currentDerivedSnapshot`, which
 * builds for their own inputs when the published snapshot trails them.
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
    // Watching a provider can run its answer, which may stop this
    // orchestrator or replace the inputs (another provider included). Asking
    // with what was selected before would ask a provider no longer set.
    if (!started || !shallow(inputs, selectDerivedInputs(get()))) return false;
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

  return {
    writeSettled: () => flush(),
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
  const cleanup = () => {
    unsubscribe();
    orchestrator.stop();
  };
  try {
    orchestrator.start();
  } catch (error) {
    // No handle reaches the caller, so nothing else could stop it.
    cleanup();
    throw error;
  }
  return cleanup;
}
