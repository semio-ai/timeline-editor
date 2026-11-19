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
 */
interface HostProvider extends FeedbackProvider {
  /** Tells the store the provider's answers changed, as a host's subscription would. */
  notify(): void;
  costMs: number;
  throwNext: boolean;
  calls: number;
}

function createHostProvider(): HostProvider {
  const inner = createTrackFeedbackProvider();
  const listeners = new Set<() => void>();
  const host: HostProvider = {
    costMs: 0,
    throwNext: false,
    calls: 0,
    canonical(subjects, evaluator) {
      host.calls += 1;
      if (host.throwNext) {
        host.throwNext = false;
        throw new Error("Story provider failed once on purpose.");
      }
      // A synchronous host check costs the main thread this long.
      const until = performance.now() + host.costMs;
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
  };
  return host;
}

/** What the store's inputs were written with, compared by reference. */
function writeInputs(store: AnimationStore) {
  const { tracks, animations, namespaces, animatables } = store.getState();
  return [tracks, animations, namespaces, animatables] as const;
}

/**
 * Counts writes to the store's authored data and snapshots it publishes.
 * A write is a change to tracks, animations, namespaces or animatables; a
 * publish is a new `derivedSnapshot` object.
 */
function useDerivedCounters(store: AnimationStore) {
  const [counters, setCounters] = useState({
    version: 0,
    writes: 0,
    publishes: 0,
    publishesSinceWrite: 0,
    mostPerWrite: 0,
  });
  const last = useRef({ inputs: writeInputs(store), snapshot: store.getState().derivedSnapshot });

  useEffect(
    () =>
      store.subscribe((state) => {
        const inputs = writeInputs(store);
        const wrote = inputs.some((input, index) => input !== last.current.inputs[index]);
        const published = state.derivedSnapshot !== last.current.snapshot;
        last.current = { inputs, snapshot: state.derivedSnapshot };
        if (!wrote && !published) return;
        setCounters((previous) => {
          const sinceWrite = (wrote ? 0 : previous.publishesSinceWrite) + (published ? 1 : 0);
          return {
            version: state.derivedSnapshot?.version ?? 0,
            writes: previous.writes + (wrote ? 1 : 0),
            publishes: previous.publishes + (published ? 1 : 0),
            publishesSinceWrite: sinceWrite,
            mostPerWrite: Math.max(previous.mostPerWrite, sinceWrite),
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
  const [costMs, setCostMs] = useState(host.costMs);
  const [calls, setCalls] = useState(host.calls);
  const [failure, setFailure] = useState<string>();

  useEffect(() => {
    host.costMs = costMs;
  }, [host, costMs]);

  // The provider's call count is not store state, so it is sampled.
  useEffect(() => {
    const timer = setInterval(() => setCalls(host.calls), 250);
    return () => clearInterval(timer);
  }, [host]);

  return (
    <div
      data-testid="derived-diagnostics"
      style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: 8, alignItems: "center" }}
    >
      <Text role={TextRole.Note}>
        snapshot v{counters.version} · writes {counters.writes} · publishes {counters.publishes} ·
        last write → {counters.publishesSinceWrite} publish(es) · most for one write{" "}
        {counters.mostPerWrite}
      </Text>
      <label>
        <input
          type="checkbox"
          checked={providerOn}
          onChange={(event) => setProviderOn(event.target.checked)}
        />{" "}
        <Text role={TextRole.Note}>host provider (asked {calls}×)</Text>
      </label>
      <label>
        <Text role={TextRole.Note}>provider cost {costMs} ms </Text>
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
          host.throwNext = true;
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
      {failure && <Text role={TextRole.Note}>build threw: {failure}</Text>}
    </div>
  );
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
