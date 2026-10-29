import { describe, expect, it } from "vitest";
import { runtimeInputId } from "@semio/data";
import { createTrack } from "../actions/create-track";
import type { AnimationData } from "../store-types";

/** A store holding one empty animation and the records `createTrack` reads. */
const state = () =>
  ({
    animatables: {},
    tracks: {},
    animations: { anim: { id: "anim", name: "anim", tracks: [], groups: [] } },
  }) as unknown as AnimationData;

describe("createTrack", () => {
  it("names the input a track on an input beyond the model animates by its key", () => {
    const track = createTrack(state(), runtimeInputId("speaker/gain"), "anim", {});
    expect(track.animatableId).toBe(runtimeInputId("speaker/gain"));
    expect(track.inputKey).toBe("speaker/gain");
  });

  it("gives a track on an animatable no input key", () => {
    const track = createTrack(state(), "anim-joint", "anim", {});
    expect(track).not.toHaveProperty("inputKey");
  });
});
