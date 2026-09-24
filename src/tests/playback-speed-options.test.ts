import { describe, expect, it } from "vitest";
import { defaultIconRegistry } from "@semio/ui";
import { PLAYBACK_SPEED_OPTIONS } from "../components/playback-speed-options";
import { animationIconRegistry } from "../icons/registry";

describe("playback speed options", () => {
  it("offers 0.1x through 2x, slowest first", () => {
    expect(PLAYBACK_SPEED_OPTIONS.map((option) => option.value)).toEqual([
      "0.1",
      "0.5",
      "1",
      "1.5",
      "2",
    ]);
  });

  it("uses values the select can match against the store's speed", () => {
    // The select compares against `speed.toString()`, so a value spelled any other
    // way ("1.0") would leave that speed unselectable.
    for (const option of PLAYBACK_SPEED_OPTIONS) {
      expect(parseFloat(option.value).toString()).toBe(option.value);
    }
  });

  it("gives every speed its own registered glyph", () => {
    const icons = PLAYBACK_SPEED_OPTIONS.map((option) => option.icon);
    expect(new Set(icons).size).toBe(icons.length);
    const registry: Record<string, unknown> = { ...defaultIconRegistry, ...animationIconRegistry };
    for (const icon of icons) expect(registry[icon]).toBeDefined();
  });

  it("keeps the deprecated speed keys resolving to the matching speed glyphs", () => {
    expect(animationIconRegistry["speed-slow"]).toBe(defaultIconRegistry["playback-0.5"]);
    expect(animationIconRegistry["speed-normal"]).toBe(defaultIconRegistry["playback-1.0"]);
    expect(animationIconRegistry["speed-fast"]).toBe(defaultIconRegistry["playback-1.5"]);
    expect(animationIconRegistry["speed-fastest"]).toBe(defaultIconRegistry["playback-2.0"]);
  });
});
