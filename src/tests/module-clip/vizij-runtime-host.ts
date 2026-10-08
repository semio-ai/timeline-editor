import { startRuntime, type Runtime } from "@vizij/runtime";
import { bakedSamples } from "../../functions/baked-animation";
import type { ModuleClip } from "../../functions/to-module-clip";

/** One sampled value, as the module outputs it. */
export type ModuleSample = number | string | boolean;

/** Per output key (a track's `animatable_id`), the sampled values in frame order. */
export type ModuleSeries = Map<string, ModuleSample[]>;

/** A clip played by the module's step: its outputs, and the player's time at each step. */
export interface PlayedClip {
  series: ModuleSeries;
  /** The player's time after each step, in milliseconds, as the module reports it. */
  timesMs: number[];
}

/**
 * What the fidelity tests ask of whatever runs the Vizij animation module.
 * {@link startVizijRuntimeHost} answers it in Node through `@vizij/runtime`,
 * whose device links the module's crate; a host over an emulated device of
 * the World (its `bake`, its step) answers the same two questions.
 */
export interface ModuleClipHost {
  /** The module's `bake` of `clip` at `rateHz`, from clip time 0 to its end. */
  bake(clip: ModuleClip, rateHz: number): Promise<ModuleSeries>;
  /**
   * `clip` played once (no loop) from time 0 by the module's `step`: one
   * step of 0, then `steps` steps of `dtMs`, one sample per step.
   */
  play(clip: ModuleClip, dtMs: number, steps: number): Promise<PlayedClip>;
}

/** The module's id, function and parameter ids (vizij-animation-module `src/lib.rs`). */
const MODULE = "76697a69-6a00-0000-0d00-000000000000";
const FN = {
  loadAnimation: "76697a69-6a00-0000-0f00-000000000001",
  createPlayer: "76697a69-6a00-0000-0f00-000000000002",
  addInstance: "76697a69-6a00-0000-0f00-000000000003",
  step: "76697a69-6a00-0000-0f00-000000000004",
  play: "76697a69-6a00-0000-0f00-000000000005",
  setLoop: "76697a69-6a00-0000-0f00-00000000000a",
  playerStates: "76697a69-6a00-0000-0f00-00000000000d",
  bake: "76697a69-6a00-0000-0f00-00000000000e",
} as const;
const PARAM = {
  clip: "76697a69-6a00-0000-0f01-000000000001",
  playerName: "76697a69-6a00-0000-0f02-000000000001",
  player: "76697a69-6a00-0000-0f03-000000000001",
  anim: "76697a69-6a00-0000-0f03-000000000002",
  dtNs: "76697a69-6a00-0000-0f04-000000000001",
  playPlayer: "76697a69-6a00-0000-0f05-000000000001",
  loopPlayer: "76697a69-6a00-0000-0f0a-000000000001",
  loopMode: "76697a69-6a00-0000-0f0a-000000000002",
  bakeAnim: "76697a69-6a00-0000-0f0e-000000000001",
  bakeFrameRate: "76697a69-6a00-0000-0f0e-000000000002",
} as const;
const OUTPUT_KEY = "76697a69-6a00-0000-0110-000000000002";
const OUTPUT_VALUE = "76697a69-6a00-0000-0110-000000000003";
const STATE_TIME_NS = "76697a69-6a00-0000-0111-000000000003";

/** The Vizij animation module in Node: a fresh `@vizij/runtime` device per clip. */
export function startVizijRuntimeHost(): ModuleClipHost {
  return {
    async bake(clip, rateHz) {
      return withDevice(async (call) => {
        const [anim] = await call([{ id: FN.loadAnimation, args: [field(PARAM.clip, clip)] }]);
        const [baked] = await call([
          {
            id: FN.bake,
            args: [field(PARAM.bakeAnim, anim), field(PARAM.bakeFrameRate, { f32: rateHz })],
          },
        ]);
        return new Map(
          [...bakedSamples(baked)].map(([key, samples]) => [
            key,
            samples.map((s) => sampleOf(s as ValueJson)),
          ]),
        );
      });
    },

    async play(clip, dtMs, steps) {
      return withDevice(async (call) => {
        const [anim, player] = await call([
          { id: FN.loadAnimation, args: [field(PARAM.clip, clip)] },
          { id: FN.createPlayer, args: [field(PARAM.playerName, { str: "fidelity" })] },
        ]);
        await call([
          { id: FN.addInstance, args: [field(PARAM.player, player), field(PARAM.anim, anim)] },
        ]);
        const dtNs = Math.round(dtMs * 1e6);
        // Each step is followed by a read of the player's time.
        const stepCalls = Array.from({ length: steps + 1 }, (_, i) => [
          { id: FN.step, args: [field(PARAM.dtNs, { u64: i === 0 ? 0 : dtNs })] },
          { id: FN.playerStates, args: [] },
        ]).flat();
        const [, , ...replies] = await call([
          {
            id: FN.setLoop,
            args: [field(PARAM.loopPlayer, player), field(PARAM.loopMode, { str: "once" })],
          },
          { id: FN.play, args: [field(PARAM.playPlayer, player)] },
          ...stepCalls,
        ]);
        const series: ModuleSeries = new Map();
        const timesMs: number[] = [];
        for (let i = 0; i < replies.length; i += 2) {
          for (const output of structsOf(replies[i])) {
            const values = fieldsOf(output);
            const key = stringOf(values[OUTPUT_KEY]);
            const samples = series.get(key) ?? [];
            samples.push(sampleOf(values[OUTPUT_VALUE]));
            series.set(key, samples);
          }
          const [state] = structsOf(replies[i + 1]);
          timesMs.push(numberOf(fieldsOf(state)[STATE_TIME_NS]) / 1e6);
        }
        return { series, timesMs };
      });
    },
  };
}

/** An arora `Value` in its JSON form: one variant tag and its content. */
type ValueJson = Record<string, unknown>;

interface Field {
  id: string;
  value: ValueJson;
}

interface Call {
  id: string;
  args: Field[];
}

/**
 * Runs `body` against a new device, then disposes of it. `call` issues its
 * calls in order and dispatches them all in the device's next step.
 */
async function withDevice<T>(
  body: (call: (calls: Call[]) => Promise<ValueJson[]>) => Promise<T>,
): Promise<T> {
  const runtime: Runtime = await startRuntime();
  try {
    return await body(async (calls) => {
      // A device dispatches a call to the module it names.
      const pending = calls.map((c) => runtime.call({ module_id: MODULE, ...c }));
      runtime.step(0);
      const results = await Promise.all(pending);
      return results.map((r) => r.ret as ValueJson);
    });
  } finally {
    runtime.dispose();
  }
}

function field(id: string, value: ValueJson | ModuleClip): Field {
  return { id, value: value as ValueJson };
}

function fieldsOf(structure: { fields: Field[] }): Record<string, ValueJson> {
  return Object.fromEntries(structure.fields.map((f) => [f.id, f.value]));
}

function numberOf(value: ValueJson | undefined): number {
  const sample = sampleOf(value);
  if (typeof sample === "number") return sample;
  throw new Error(`expected a number, got ${JSON.stringify(value)}`);
}

function stringOf(value: ValueJson | undefined): string {
  if (typeof value?.str === "string") return value.str;
  throw new Error(`expected a string, got ${JSON.stringify(value)}`);
}

function structsOf(value: ValueJson): { fields: Field[] }[] {
  const structs = value.structs as { elements: { fields: Field[] }[] } | undefined;
  if (structs) return structs.elements;
  throw new Error(`expected an array of structures, got ${JSON.stringify(value)}`);
}

/** A sampled value, or a player's `u64` time. */
function sampleOf(value: ValueJson | undefined): ModuleSample {
  for (const variant of ["f32", "f64", "u64", "bool", "str"]) {
    const content = value?.[variant];
    if (content !== undefined) return content as ModuleSample;
  }
  throw new Error(`unexpected value ${JSON.stringify(value)}`);
}
