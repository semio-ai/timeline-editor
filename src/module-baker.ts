import { startRuntime, type Runtime } from "@vizij/runtime";
import { fromTaggedValue } from "@semio/utils";
import { bakedSamples } from "./functions/baked-animation";
import { singleTrackClip, type ModuleClip } from "./functions/to-module-clip";
import type { TrackBaker } from "./functions/track-curve";
import type { SimpleRawValue } from "./types/data/simple-track";
import type { AnimationStore } from "./store";

/**
 * Gives `store` the curves of the Vizij animation module with no device in the
 * page: its tracks are baked by the module itself, run by `@vizij/runtime`, the
 * published Arora device of Vizij that links it. A host with a device of its
 * own (Studio bakes on an emulated device) passes that baker instead; this is
 * for a page that has none — a story, another app.
 *
 * The runtime answers a call one step later, so a track is baked
 * asynchronously: the store's baker answers `undefined` for a track not baked
 * yet, then, once a round of bakes lands, the store gets a fresh baker that
 * answers them, and the timeline draws them. The runtime (25 MB of wasm, Bevy
 * included) is fetched on the first bake, from this entry point only, so a
 * host that bakes elsewhere never loads it.
 *
 * Returns the function that takes the baker back.
 */
export function attachModuleBaker(store: AnimationStore): () => void {
  const baked = new Map<string, SimpleRawValue[] | undefined>();
  const pending = new Map<string, BakeRequest>();
  let running: Promise<void> | undefined;
  let detached = false;

  const answer: TrackBaker = (clip, trackId, rateHz) => {
    const key = `${rateHz}|${trackId}|${JSON.stringify(clip)}`;
    if (baked.has(key)) return baked.get(key);
    pending.set(key, { clip, trackId, rateHz });
    running ??= bakeRounds()
      .catch((error: unknown) => console.error("The Vizij animation module could not bake", error))
      .finally(() => (running = undefined));
    return undefined;
  };
  // A new identity per round: the timeline keeps each baker's curves, so a
  // fresh one is what makes it ask again for the tracks that were pending.
  const freshBaker = (): TrackBaker => (clip, trackId, rateHz) => answer(clip, trackId, rateHz);
  let current = freshBaker();
  store.setState({ trackBaker: current });

  async function bakeRounds(): Promise<void> {
    // The first round waits for the store's update to finish asking.
    await Promise.resolve();
    while (pending.size > 0 && !detached) {
      const round = [...pending];
      pending.clear();
      const samples = await bakeOnModule(round.map(([, request]) => request));
      if (detached) return;
      round.forEach(([key], i) => remember(baked, key, samples[i]));
      current = freshBaker();
      store.setState({ trackBaker: current });
    }
  }

  return () => {
    detached = true;
    if (store.getState().trackBaker === current) store.setState({ trackBaker: undefined });
  };
}

interface BakeRequest {
  clip: ModuleClip;
  trackId: string;
  rateHz: number;
}

/** The most bakes kept; the oldest go first. */
const KEPT_BAKES = 2048;

function remember(
  baked: Map<string, SimpleRawValue[] | undefined>,
  key: string,
  samples: SimpleRawValue[] | undefined,
): void {
  baked.set(key, samples);
  if (baked.size > KEPT_BAKES) baked.delete(baked.keys().next().value!);
}

/**
 * Each request's samples, baked on one fresh runtime, which is disposed of
 * with what it loaded: the track alone, keyed by its id, from clip time 0 to
 * the clip's end at the request's rate, as the World's `bake` takes it. The
 * module's functions are called by name, Arora's invoke, with their declared
 * parameters. `undefined` for a track the module refuses or answers with a
 * value no track holds.
 */
async function bakeOnModule(requests: BakeRequest[]): Promise<(SimpleRawValue[] | undefined)[]> {
  const runtime = await startRuntime();
  try {
    // An invoke is applied inside a step of the device's; this one is paced
    // by hand, a step per round until every call of the round has answered or
    // the round's steps are spent. A call that has not answered by then, or
    // failed, answers `undefined`.
    const round = async (calls: Promise<unknown>[]): Promise<unknown[]> => {
      const answers: unknown[] = calls.map(() => undefined);
      let pending = calls.length;
      calls.forEach(
        (call, i) =>
          void call
            .then(
              (ret) => (answers[i] = ret),
              () => undefined,
            )
            .finally(() => pending--),
      );
      for (let steps = 0; pending > 0 && steps < MAX_STEPS; steps++) {
        runtime.step(0);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      return answers;
    };
    // The arguments are arora `Value`s in their JSON form, which `invoke`
    // takes as they are.
    const invoke = (method: string, args: Record<string, unknown>) =>
      runtime.invoke(method, args as Parameters<Runtime["invoke"]>[1]);
    const anims = await round(
      requests.map(({ clip, trackId }) =>
        invoke("load_animation", { clip: singleTrackClip(clip, trackId) }),
      ),
    );
    const bakes = await round(
      requests.map(({ rateHz }, i) =>
        anims[i] === undefined
          ? Promise.resolve(undefined)
          : invoke("bake", { anim: anims[i], frame_rate: { f32: rateHz } }),
      ),
    );
    return requests.map(({ trackId }, i) => samplesOf(bakes[i], trackId));
  } finally {
    runtime.dispose();
  }
}

/** The steps a round of calls is given to answer. */
const MAX_STEPS = 16;

/**
 * The samples of `trackId` in the module's bake, as the timeline reads them;
 * `undefined` when the module baked nothing for it or a sample is no scalar.
 */
function samplesOf(baked: unknown, trackId: string): SimpleRawValue[] | undefined {
  let values: unknown[] | undefined;
  try {
    values = bakedSamples(baked).get(trackId);
  } catch {
    return undefined;
  }
  const samples = values?.map(fromTaggedValue);
  return samples && samples.every((s) => s !== undefined) ? samples : undefined;
}
