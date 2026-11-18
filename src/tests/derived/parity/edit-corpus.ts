import { vi } from "vitest";
import { StandardTransitionType, TransitionPairing } from "../../../types";
import type { AnimationStore } from "../../../store";
import { createTestAnimationStore } from "../../../test-fixtures/animation-store-factory";
import { testTrackEvaluator } from "../../../test-fixtures/track-evaluator";
import { getMarkerFrame } from "../../selection/selection-test-helpers";

/**
 * A seeded generator of edit sequences over the shared test store, covering
 * every kind of input the derived snapshot reads: key values, stamps,
 * insertions, removals and transitions; key, value and cancelled drags;
 * duration, timescale and constraint changes; visibility, mute and lock;
 * selection; and the vertical viewport.
 *
 * Each step is one outermost store action, so a test can check what the store
 * derived after it. A step that the store rejects (it throws) is still a step:
 * the rejection is part of the behaviour being compared.
 */
export interface CorpusStep {
  label: string;
  run: (store: AnimationStore) => void;
}

const MODS = { alt: false, shift: false, meta: false };
const VIEW_ID = "parity-view";

/**
 * Makes the ids the store generates (new keys, pasted keys) a sequence, from
 * the next call on. Some derived ids join generated ids in sorted order, so
 * random ids would make one revision disagree with itself. Violation ids are
 * left random: they are normalized away, and a revision that stops generating
 * them must not shift everyone else's.
 */
export function installSequentialIds(): () => void {
  const original = crypto.randomUUID.bind(crypto);
  let next = 0;
  const spy = vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
    if (new Error().stack?.includes("computeTrackViolations")) return original();
    next += 1;
    return `00000000-0000-4000-8000-${String(next).padStart(12, "0")}`;
  });
  return () => spy.mockRestore();
}

export function createCorpusStore(): AnimationStore {
  const store = createTestAnimationStore({ trackEvaluator: testTrackEvaluator });
  store.getState().addView({ id: VIEW_ID });
  return store;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rows whose single entry is a numeric track in the selection instance. */
function editableLeafRows(store: AnimationStore) {
  const state = store.getState();
  return Object.values(state.instancedTrackSources)
    .filter((row) => !row.isGroup && row.data.length === 1)
    .filter((row) => {
      const datum = row.data[0];
      const track = state.tracks[datum.trackId];
      return (
        datum.instanceId === state.selectionState.instanceId &&
        datum.editable &&
        track &&
        track.points.length > 0 &&
        typeof track.points[0].value === "number"
      );
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function allRows(store: AnimationStore) {
  return Object.keys(store.getState().instancedTrackSources).sort();
}

/**
 * The steps for one seed. They are generated lazily from the state the
 * previous steps left, so a step always addresses keys and rows that exist.
 */
export function* corpusSteps(seed: number, length: number): Generator<CorpusStep> {
  const random = mulberry32(seed);
  const int = (n: number) => Math.floor(random() * n);
  const pick = <T>(items: readonly T[]): T | undefined =>
    items.length === 0 ? undefined : items[int(items.length)];

  let store!: AnimationStore;
  yield {
    label: "bind",
    run: (s) => {
      store = s;
    },
  };

  const kinds = [
    "value",
    "stamp",
    "add",
    "remove",
    "transitions",
    "flatten",
    "keyDrag",
    "valueDrag",
    "duration",
    "timescale",
    "constraints",
    "visible",
    "muted",
    "locked",
    "viewHidden",
    "select",
    "clearSelection",
    "selectAll",
    "viewport",
  ] as const;

  for (let i = 0; i < length; i += 1) {
    const kind = pick(kinds)!;
    const state = store.getState();
    const leafRow = pick(editableLeafRows(store));
    const datum = leafRow?.data[0];
    const track = datum ? state.tracks[datum.trackId] : undefined;
    const point = track ? pick(track.points) : undefined;

    switch (kind) {
      case "value":
        if (!track || !point) break;
        yield {
          label: `value ${track.id}/${point.id}`,
          run: (s) =>
            s.getState().updateKeypoint(track.id, {
              id: point.id,
              value: (point.value as number) + (random() - 0.5) * 40,
            }),
        };
        break;
      case "stamp":
        if (!track || !point) break;
        yield {
          label: `stamp ${track.id}/${point.id}`,
          run: (s) =>
            s.getState().updateKeypoint(track.id, {
              id: point.id,
              stamp: Math.max(0, point.stamp + (int(2) ? 1 : -1) * 100 * (1 + int(5))),
            }),
        };
        break;
      case "add":
        if (!track || !datum) break;
        {
          const stamp = 50 * (1 + int(80));
          yield {
            label: `add ${track.id}@${stamp}`,
            run: (s) => s.getState().insertKeypointAtWorldStamp(track.id, stamp, datum.instanceId),
          };
        }
        break;
      case "remove":
        if (!track || !point || track.points.length < 3) break;
        yield {
          label: `remove ${track.id}/${point.id}`,
          run: (s) => s.getState().removeKeypoint(track.id, point.id),
        };
        break;
      case "transitions": {
        const easing = pick(Object.values(StandardTransitionType))!;
        const pairing = pick(Object.values(TransitionPairing));
        yield* selectStep();
        yield {
          label: `transitions ${easing}/${pairing}`,
          run: (s) =>
            s
              .getState()
              .updateSelectedKeyTransitions(
                int(2) ? { in: easing, out: easing } : { out: easing, pairing },
              ),
        };
        break;
      }
      case "flatten":
        yield* selectStep();
        yield { label: "flatten", run: (s) => s.getState().flattenSelectedKeyHandles() };
        break;
      case "keyDrag": {
        if (!leafRow || !point) break;
        const axis = int(2) ? "vertical" : "horizontal";
        const rowId = leafRow.id;
        let markerId: string | undefined;
        yield {
          label: `keyDrag select ${rowId}/${point.id}`,
          run: (s) => {
            const frame = getMarkerFrame(s, rowId, point.id);
            markerId = frame.id;
            const points = (frame.points ?? []).filter((p) => p.selectable ?? true);
            s.getState().clickMarker(points, rowId, frame.id, false, false);
          },
        };
        yield {
          label: `keyDrag start ${axis}`,
          run: (s) => s.getState().startDrag({ axis, markerId: markerId!, rowId }),
        };
        const moves = 1 + int(3);
        for (let m = 0; m < moves; m += 1) {
          const delta = (random() - 0.5) * 0.6;
          const stamp = 0.1 + random() * 0.8;
          yield {
            label: `keyDrag move ${m}`,
            run: (s) =>
              s
                .getState()
                .updateDrag(
                  axis === "vertical"
                    ? { normalizedValueDelta: delta, modifiers: MODS }
                    : { normalizedStamp: { current: stamp }, modifiers: MODS },
                ),
          };
        }
        const commit = random() < 0.7;
        yield {
          label: `keyDrag ${commit ? "commit" : "cancel"}`,
          run: (s) => (commit ? s.getState().commitDrag() : s.getState().cancelDrag()),
        };
        break;
      }
      case "valueDrag": {
        if (!leafRow || !datum || !track) break;
        const worldStamp = int(2) && point ? point.stamp : 50 * (1 + int(80));
        yield {
          label: `valueDrag start ${track.id}@${worldStamp}`,
          run: (s) =>
            s.getState().startValueDrag({
              rowId: leafRow.id,
              trackId: track.id,
              namespaceId: datum.namespaceId,
              instanceId: datum.instanceId,
              worldStamp,
            }),
        };
        const moves = 1 + int(3);
        for (let m = 0; m < moves; m += 1) {
          const value = (random() - 0.5) * 200;
          yield {
            label: `valueDrag move ${m}`,
            run: (s) => s.getState().updateValueDrag({ currentValue: value, modifiers: MODS }),
          };
        }
        const commit = random() < 0.7;
        yield {
          label: `valueDrag ${commit ? "commit" : "cancel"}`,
          run: (s) => (commit ? s.getState().commitValueDrag() : s.getState().cancelValueDrag()),
        };
        break;
      }
      case "duration": {
        const animationId = pick(Object.keys(state.animations).sort());
        if (!animationId) break;
        const duration = 1000 + 500 * int(12);
        const rescale = random() < 0.3;
        yield {
          label: `duration ${animationId}=${duration} rescale=${rescale}`,
          run: (s) => s.getState().updateAnimationDuration(animationId, duration, rescale),
        };
        break;
      }
      case "timescale": {
        const namespaceId = pick(Object.keys(state.namespaces).sort());
        if (!namespaceId) break;
        const instanceId = pick(
          Object.keys(state.namespaces[namespaceId].animationInstances).sort(),
        );
        if (!instanceId) break;
        const timescale = pick([0.5, 1, 1.5, 2, -1])!;
        yield {
          label: `timescale ${namespaceId}/${instanceId}=${timescale}`,
          run: (s) => {
            const namespaces = s.getState().namespaces;
            const namespace = namespaces[namespaceId];
            const instance = namespace.animationInstances[instanceId];
            s.getState().setNamespaces({
              ...namespaces,
              [namespaceId]: {
                ...namespace,
                animationInstances: {
                  ...namespace.animationInstances,
                  [instanceId]: { ...instance, settings: { ...instance.settings, timescale } },
                },
              },
            });
          },
        };
        break;
      }
      case "constraints": {
        const numeric = Object.values(state.animatables)
          .filter((animatable) => animatable.type === "number")
          .map((animatable) => animatable.id)
          .sort();
        const animatableId = pick(numeric);
        if (!animatableId) break;
        const min = -int(60);
        const max = int(60);
        const velocity = random() < 0.5 ? 20 + int(400) : undefined;
        yield {
          label: `constraints ${animatableId} [${min},${max}] v=${velocity}`,
          run: (s) =>
            s.getState().updateAnimatable(animatableId, {
              constraints: { min, max, ...(velocity !== undefined ? { velocity } : {}) },
            } as never),
        };
        break;
      }
      case "visible":
      case "muted":
      case "locked": {
        const rowId = pick(allRows(store).filter((id) => id !== "global"));
        if (!rowId) break;
        const on = random() < 0.5;
        yield {
          label: `${kind} ${rowId}=${on}`,
          run: (s) => {
            const actions = s.getState();
            if (kind === "visible") actions.setTracksVisible(rowId, on);
            else if (kind === "muted") actions.setTracksMuted(rowId, on);
            else actions.setTracksLocked(rowId, on);
          },
        };
        break;
      }
      case "viewHidden": {
        const rowId = pick(allRows(store).filter((id) => id !== "global"));
        if (!rowId) break;
        const hidden = random() < 0.5;
        yield {
          label: `viewHidden ${rowId}=${hidden}`,
          run: (s) => s.getState().updateViewTrackVisibility(VIEW_ID, { [rowId]: { hidden } }),
        };
        break;
      }
      case "select":
        yield* selectStep();
        break;
      case "clearSelection":
        yield { label: "clearSelection", run: (s) => s.getState().clearSelection() };
        break;
      case "selectAll":
        yield { label: "selectAll", run: (s) => s.getState().selectAll() };
        break;
      case "viewport": {
        const top = 10 + int(90);
        const bottom = -10 - int(90);
        const clear = random() < 0.2;
        yield {
          label: `viewport ${clear ? "clear" : `${top}/${bottom}`}`,
          run: (s) =>
            s.getState().setVerticalViewport(VIEW_ID, clear ? undefined : { top, bottom }),
        };
        break;
      }
    }
  }

  function* selectStep(): Generator<CorpusStep> {
    const rowId = pick(allRows(store));
    if (!rowId) return;
    const frames = store.getState().derivedSnapshot?.rows[rowId]?.computed.selection ?? [];
    const frame = pick(frames);
    if (!frame) return;
    const shift = random() < 0.2;
    const mod = random() < 0.2;
    yield {
      label: `select ${rowId}/${frame.id}${shift ? " shift" : ""}${mod ? " mod" : ""}`,
      run: (s) => {
        const current = getMarkerFrame(s, rowId, frame.id);
        const points = (current.points ?? []).filter((p) => p.selectable ?? true);
        s.getState().clickMarker(points, rowId, current.id, shift, mod);
      },
    };
  }
}

/** Runs one step, returning the error message if the store rejected it. */
export function runStep(store: AnimationStore, step: CorpusStep): string | undefined {
  try {
    step.run(store);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const CURVE_SAMPLES = [-50, 0, 37, 250, 777, 1500, 3333, 6000];

interface ViolationLike {
  id: string;
  stampRange: { start: number; end: number };
  type: string;
  trackId: string;
  namespace: string;
  instanceId: string;
}

function isViolation(value: unknown): value is ViolationLike {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.type === "string" &&
    typeof v.trackId === "string" &&
    typeof v.namespace === "string" &&
    typeof v.instanceId === "string" &&
    typeof v.stampRange === "object"
  );
}

/**
 * A violation's identity as content: where it is, what kind, and where it
 * starts. Two violations of one kind on one track instance cannot start at the
 * same stamp, so this names exactly one violation.
 */
export function violationContentKey(v: ViolationLike): string {
  return `${v.namespace}/${v.instanceId}/${v.trackId}:${v.type}@${v.stampRange.start}`;
}

/**
 * A comparable, JSON-safe form of store state. Functions (curves) become
 * samples, Maps and Sets become sorted entries, violation ids become their
 * content key, the snapshot's `version` (a build counter) is dropped, and any
 * remaining random UUID becomes its order of first appearance.
 *
 * `violationSet.id` is derived from the violation ids, so it is dropped here;
 * a separate check covers its determinism.
 */
export function normalize(value: unknown): unknown {
  const violationIds = new Map<string, string>();
  const collect = (node: unknown, seen: Set<unknown>) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (isViolation(node)) violationIds.set(node.id, violationContentKey(node));
    if (node instanceof Map) node.forEach((v) => collect(v, seen));
    else if (node instanceof Set) node.forEach((v) => collect(v, seen));
    else if (!ArrayBuffer.isView(node)) Object.values(node).forEach((v) => collect(v, seen));
  };
  collect(value, new Set());

  const uuids = new Map<string, string>();
  const mapString = (s: string) => {
    const violation = violationIds.get(s);
    if (violation) return `violation:${violation}`;
    // Generated ids also appear inside composite ids (a frame id embeds its key's).
    return s.replace(UUID, (uuid) => {
      if (!uuids.has(uuid)) uuids.set(uuid, `uuid#${uuids.size}`);
      return uuids.get(uuid)!;
    });
  };

  const walk = (node: unknown, key?: string): unknown => {
    if (typeof node === "string") return mapString(node);
    if (typeof node === "number") return Number.isNaN(node) ? "NaN" : node;
    if (typeof node === "function") {
      return CURVE_SAMPLES.map((t) => {
        try {
          const v = (node as (t: number) => unknown)(t);
          return v === undefined ? null : walk(v);
        } catch {
          return "throws";
        }
      });
    }
    if (!node || typeof node !== "object") return node ?? null;
    if (ArrayBuffer.isView(node)) return Array.from(node as unknown as ArrayLike<number>);
    if (node instanceof Map) {
      return Array.from(node.entries())
        .map(([k, v]) => [walk(k), walk(v)] as const)
        .sort((a, b) => JSON.stringify(a[0]).localeCompare(JSON.stringify(b[0])));
    }
    if (node instanceof Set) {
      return Array.from(node)
        .map((v) => walk(v))
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }
    if (Array.isArray(node)) return node.map((v) => walk(v));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if ((key === undefined || key === "derivedSnapshot") && k === "version") continue;
      if (k === "id" && typeof v === "string" && v.startsWith("violationset-")) continue;
      out[mapString(k)] = walk(v, k);
    }
    return out;
  };
  return walk(value);
}

/** The parts of the store a parity check compares after each step. */
export function observedState(store: AnimationStore) {
  const s = store.getState();
  return {
    derivedSnapshot: s.derivedSnapshot,
    tracks: s.tracks,
    selectionState: s.selectionState,
    dragState: s.dragState,
    instancedTrackSources: s.instancedTrackSources,
    sourceRowIds: s.sourceRowIds,
    sourceRowIdsByView: s.sourceRowIdsByView,
    animations: s.animations,
    namespaces: s.namespaces,
    animatables: s.animatables,
  };
}
