// Records, or compares against, what the store holds after every step of the
// edit corpus. Recording on one revision and comparing on another checks that a
// change to how the store derives its state leaves every observable result as
// it was. Off unless PARITY_RECORD or PARITY_COMPARE names a file.
import { createReadStream, createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { describe, expect, it } from "vitest";
import {
  corpusSteps,
  createCorpusStore,
  normalize,
  observedState,
  runStep,
  installSequentialIds,
} from "./edit-corpus";

const RECORD = process.env.PARITY_RECORD;
const COMPARE = process.env.PARITY_COMPARE;
const SEEDS = Number(process.env.PARITY_SEEDS ?? 12);
const LENGTH = Number(process.env.PARITY_LENGTH ?? 40);

interface Entry {
  seed: number;
  step: number;
  label: string;
  error?: string;
  builds: number;
  state: unknown;
}

function* entries(): Generator<Entry> {
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const restoreIds = installSequentialIds();
    const store = createCorpusStore();
    let step = 0;
    for (const corpusStep of corpusSteps(seed, LENGTH)) {
      const before = store.getState().derivedSnapshot?.version ?? 0;
      const error = runStep(store, corpusStep);
      const builds = (store.getState().derivedSnapshot?.version ?? 0) - before;
      yield {
        seed,
        step,
        label: corpusStep.label,
        error,
        builds,
        state: normalize(observedState(store)),
      };
      step += 1;
    }
    restoreIds();
  }
}

/** A step label with its generated ids blanked: they differ run to run. */
function withoutIds(label: string): string {
  return label.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>");
}

/** The first path at which two JSON values differ, with both values there. */
function firstDifference(a: unknown, b: unknown, path: string): string | undefined {
  if (Object.is(a, b)) return undefined;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return `${path || "<root>"}: ${JSON.stringify(a)?.slice(0, 300)} !== ${JSON.stringify(b)?.slice(0, 300)}`;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: array vs object`;
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  for (const key of keys) {
    const found = firstDifference(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      `${path}.${key}`,
    );
    if (found) return found;
  }
  return undefined;
}

describe.runIf(RECORD || COMPARE)("edit corpus against a recording", () => {
  it.runIf(RECORD)(
    "records",
    async () => {
      const out = createWriteStream(RECORD!);
      for (const entry of entries()) out.write(`${JSON.stringify(entry)}\n`);
      await new Promise<void>((resolve) => out.end(resolve));
    },
    600_000,
  );

  it.runIf(COMPARE)(
    "matches",
    async () => {
      const lines = createInterface({ input: createReadStream(COMPARE!) })[Symbol.asyncIterator]();
      const next = async (): Promise<Entry | undefined> => {
        for (;;) {
          const { value, done } = await lines.next();
          if (done) return undefined;
          if (value) return JSON.parse(value) as Entry;
        }
      };

      const builds: Record<string, { before: number[]; after: number[] }> = {};
      let index = 0;
      for (const entry of entries()) {
        const expected = await next();
        expect(
          expected,
          `recording ends before seed ${entry.seed} step ${entry.step}`,
        ).toBeDefined();
        if (!expected) return;
        expect(withoutIds(entry.label), `seed ${entry.seed} step ${entry.step}`).toBe(
          withoutIds(expected.label),
        );
        expect(entry.error, `${entry.label} (seed ${entry.seed} step ${entry.step})`).toBe(
          expected.error,
        );
        const actual = JSON.parse(JSON.stringify(entry.state));
        // The build counter is how many builds ran, which a revision may change;
        // a recording can carry it from a normalizer that kept it.
        delete (expected.state as { derivedSnapshot?: { version?: number } }).derivedSnapshot
          ?.version;
        const difference = firstDifference(actual, expected.state, "");
        expect(
          difference,
          `${entry.label} (seed ${entry.seed} step ${entry.step})`,
        ).toBeUndefined();
        const words = entry.label.split(" ");
        const kind = words[0].endsWith("Drag") ? `${words[0]} ${words[1]}` : words[0];
        builds[kind] ??= { before: [], after: [] };
        builds[kind].before.push(expected.builds);
        builds[kind].after.push(entry.builds);
        index += 1;
      }
      expect(await next(), "recording has more steps than the corpus").toBeUndefined();

      const summary = Object.entries(builds)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([kind, { before, after }]) => {
          const mean = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2);
          return `${kind.padEnd(22)} n=${String(before.length).padStart(3)}  builds before ${mean(before)} (max ${Math.max(...before)})  after ${mean(after)} (max ${Math.max(...after)})`;
        });
      console.log(`\nCompared ${index} steps.\n${summary.join("\n")}`);
    },
    600_000,
  );
});
