import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import useMeasure from "react-use-measure";
import {
  AnimationSheet,
  AnimationContext,
  type AnimationStore,
  createTestAnimationStore,
  INSTANCE_IDS,
  testTrackEvaluator,
} from "@semio/timeline-editor";
import { Text, TextRole } from "@semio/ui";
import { createValuesStore, DataStoreContext, valuesDataStore } from "@semio/data";
import { shallow } from "zustand/shallow";
import { selectDerivedInputs } from "../src/subscriptions/init-derived-orchestrator";
import {
  createTrackFeedbackProvider,
  type FeedbackProvider,
} from "../src/functions/feedback-provider";

const meta = {
  title: "animation/DerivedSnapshot",
  component: AnimationSheet,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AnimationSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A host feedback provider whose cost and failures can be set from the story.
 * Its answers come from the editor's own provider, so violations look the
 * same with it on or off; what changes is how often it is asked, how long
 * each answer takes, and whether an answer throws.
 *
 * The store deep-freezes the plain objects in its state, this provider
 * included, so everything the story changes lives in the closure and is
 * reached through methods.
 */
interface HostProvider extends FeedbackProvider {
  /** Tells the store the provider's answers changed, as a host's subscription would. */
  notify(): void;
  setCostMs(ms: number): void;
  /** Makes the next `canonical` call throw. */
  failNext(): void;
  calls(): number;
}

function createHostProvider(): HostProvider {
  const inner = createTrackFeedbackProvider();
  const listeners = new Set<() => void>();
  let costMs = 0;
  let throwNext = false;
  let calls = 0;
  return {
    canonical(subjects, evaluator) {
      calls += 1;
      if (throwNext) {
        throwNext = false;
        throw new Error("Story provider failed once on purpose.");
      }
      // A synchronous host check costs the main thread this long.
      const until = performance.now() + costMs;
      while (performance.now() < until) {
        /* busy */
      }
      return inner.canonical(subjects, evaluator);
    },
    preview: (subject, evaluator) => inner.preview(subject, evaluator),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify() {
      listeners.forEach((listener) => listener());
    },
    setCostMs(ms) {
      costMs = ms;
    },
    failNext() {
      throwNext = true;
    },
    calls: () => calls,
  };
}

/**
 * Counts changes to the snapshot's inputs and the snapshots the store
 * publishes. An input change is any write to what the snapshot is built from
 * (an edit, a selection, a view change, the provider); a publish is a new
 * `derivedSnapshot` object. The snapshots published while the store starts,
 * before any input changes, are not counted against a change.
 */
function useDerivedCounters(store: AnimationStore) {
  const [counters, setCounters] = useState({
    version: store.getState().derivedSnapshot?.version ?? 0,
    changes: 0,
    publishes: 0,
    publishesSinceChange: 0,
    mostPerChange: 0,
  });
  const last = useRef({
    inputs: selectDerivedInputs(store.getState()),
    snapshot: store.getState().derivedSnapshot,
  });

  useEffect(
    () =>
      store.subscribe((state) => {
        const inputs = selectDerivedInputs(state);
        const changed = !shallow(inputs, last.current.inputs);
        const published = state.derivedSnapshot !== last.current.snapshot;
        last.current = { inputs, snapshot: state.derivedSnapshot };
        if (!changed && !published) return;
        setCounters((previous) => {
          const changes = previous.changes + (changed ? 1 : 0);
          const sinceChange =
            changes === 0 ? 0 : (changed ? 0 : previous.publishesSinceChange) + (published ? 1 : 0);
          return {
            version: state.derivedSnapshot?.version ?? 0,
            changes,
            publishes: previous.publishes + (published ? 1 : 0),
            publishesSinceChange: sinceChange,
            mostPerChange: Math.max(previous.mostPerChange, sinceChange),
          };
        });
      }),
    [store],
  );
  return counters;
}

function Diagnostics({
  store,
  host,
  providerOn,
  setProviderOn,
}: {
  store: AnimationStore;
  host: HostProvider;
  providerOn: boolean;
  setProviderOn: (on: boolean) => void;
}): ReactNode {
  const counters = useDerivedCounters(store);
  const [costMs, setCostMs] = useState(0);
  const [calls, setCalls] = useState(host.calls());
  const [failure, setFailure] = useState<string>();

  useEffect(() => {
    host.setCostMs(costMs);
  }, [host, costMs]);

  // The provider's call count is not store state, so it is sampled.
  useEffect(() => {
    const timer = setInterval(() => setCalls(host.calls()), 250);
    return () => clearInterval(timer);
  }, [host]);

  return (
    <div
      data-testid="derived-diagnostics"
      // One row of fixed height whose numbers keep their width, so the sheet
      // below never moves while the counts change.
      style={{
        display: "flex",
        flexWrap: "nowrap",
        gap: 16,
        height: 36,
        flex: "0 0 36px",
        padding: "0 8px",
        alignItems: "center",
        overflow: "hidden",
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <Text role={TextRole.Note}>
        snapshot v<Count value={counters.version} /> · input changes{" "}
        <Count value={counters.changes} /> · publishes <Count value={counters.publishes} /> · last
        change → <Count value={counters.publishesSinceChange} digits={2} /> · most for one change{" "}
        <Count value={counters.mostPerChange} digits={2} />
      </Text>
      <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          type="checkbox"
          checked={providerOn}
          onChange={(event) => setProviderOn(event.target.checked)}
        />
        <Text role={TextRole.Note}>
          host provider, asked <Count value={calls} />×
        </Text>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <Text role={TextRole.Note}>
          cost <Count value={costMs} digits={2} /> ms
        </Text>
        <input
          type="range"
          min={0}
          max={50}
          step={5}
          value={costMs}
          disabled={!providerOn}
          onChange={(event) => setCostMs(Number(event.target.value))}
        />
      </label>
      <button type="button" disabled={!providerOn} onClick={() => host.notify()}>
        Provider changed
      </button>
      <button
        type="button"
        disabled={!providerOn}
        onClick={() => {
          // A build that throws throws to whatever started it (here, this
          // notification); the store keeps the snapshot it last published,
          // and the next write or notification builds again.
          host.failNext();
          try {
            host.notify();
            setFailure(undefined);
          } catch (error) {
            setFailure(error instanceof Error ? error.message : String(error));
          }
        }}
      >
        Fail next build
      </button>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
        <Text role={TextRole.Note}>{failure ? `build threw: ${failure}` : ""}</Text>
      </span>
    </div>
  );
}

/** A count drawn at a fixed width, so a growing number does not shift what follows. */
function Count({ value, digits = 4 }: { value: number; digits?: number }): ReactNode {
  return <span style={{ display: "inline-block", minWidth: `${digits}ch` }}>{value}</span>;
}

function DerivedSnapshotSheet({ scaled }: { scaled: boolean }): ReactNode {
  const [ref, bounds] = useMeasure();
  const values = useMemo(() => valuesDataStore(createValuesStore()), []);
  const store = useMemo(
    () =>
      scaled
        ? createTestAnimationStore({
            includeNamespaceA: false,
            includeNamespaceB: true,
            activeInstance: INSTANCE_IDS.BETA_SHARED,
            trackEvaluator: testTrackEvaluator,
          })
        : createTestAnimationStore({ trackEvaluator: testTrackEvaluator }),
    [scaled],
  );
  const host = useMemo(() => createHostProvider(), []);
  const [providerOn, setProviderOn] = useState(true);

  useEffect(() => {
    store.setState({ feedbackProvider: providerOn ? host : undefined });
  }, [store, host, providerOn]);

  return (
    <DataStoreContext.Provider value={values}>
      <AnimationContext.Provider value={store}>
        <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}>
          <Diagnostics
            store={store}
            host={host}
            providerOn={providerOn}
            setProviderOn={setProviderOn}
          />
          <div ref={ref} style={{ flex: "1 1 0", minHeight: 0 }}>
            <AnimationSheet height={bounds.height > 0 ? bounds.height : 600} />
          </div>
        </div>
      </AnimationContext.Provider>
    </DataStoreContext.Provider>
  );
}

/**
 * Both namespaces, with a host feedback provider whose cost and failures are
 * set from the bar above the sheet. Each edit should publish one snapshot.
 */
export const WithHostProvider: Story = {
  render: () => <DerivedSnapshotSheet scaled={false} />,
};

/**
 * The instance plays at 2× from 250 ms, so the playhead's world time and the
 * animation's own time differ: inserting a key at the playhead lands at the
 * animation's time, not the world's.
 */
export const ScaledInstance: Story = {
  render: () => <DerivedSnapshotSheet scaled />,
};
