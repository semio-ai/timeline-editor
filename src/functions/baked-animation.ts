import type { AroraFieldJson, AroraValueJson } from "./to-module-clip";

/** `BakedAnimation.tracks` and `BakedTrack`'s fields (vizij-animation-module `src/lib.rs`). */
const BAKED_TRACKS = "76697a69-6a00-0000-0120-000000000004";
const BAKED_TRACK_KEY = "76697a69-6a00-0000-0121-000000000001";
const BAKED_TRACK_VALUES = "76697a69-6a00-0000-0121-000000000002";

/**
 * The samples of each track in the Vizij animation module's bake, by the key
 * the track animates (its `animatable_id`), each sample an arora `Value` in
 * its JSON form. The module's `bake` answers an `Option` of a
 * `BakedAnimation` record, each track's samples one array of values; this is
 * the one reader of that record on this side. Throws when the answer is not
 * one: the module baked nothing (an animation not loaded, a bake beyond the
 * samples it takes), or answered another shape.
 */
export function bakedSamples(baked: unknown): Map<string, unknown[]> {
  const record = (baked as { option?: { struct?: { fields: AroraFieldJson[] } } } | undefined)
    ?.option?.struct;
  if (!record) throw new Error(`the module baked nothing: ${JSON.stringify(baked)}`);
  const tracks = valueOf(record.fields, BAKED_TRACKS);
  if (!tracks || !("structs" in tracks)) {
    throw new Error(`the module's bake has no tracks: ${JSON.stringify(baked)}`);
  }
  return new Map(
    tracks.structs.elements.map(({ fields }) => {
      const key = valueOf(fields, BAKED_TRACK_KEY);
      const values = valueOf(fields, BAKED_TRACK_VALUES) as { values?: unknown } | undefined;
      if (!key || !("str" in key) || !Array.isArray(values?.values)) {
        throw new Error(`a track of the module's bake is unreadable: ${JSON.stringify(fields)}`);
      }
      return [key.str, values.values];
    }),
  );
}

function valueOf(fields: AroraFieldJson[], id: string): AroraValueJson | undefined {
  return fields.find((f) => f.id === id)?.value;
}
