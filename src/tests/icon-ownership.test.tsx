import { renderToStaticMarkup } from "react-dom/server";
import { defaultIconRegistry, Icon, IconProvider } from "@semio/ui";
import { describe, expect, it } from "vitest";
import { animationIconRegistry, type AnimationIconName } from "../icons/registry";

// These keys are the editor's glyph contract, independent of its semantic aliases.
const editorGlyphKeys = [
  "angle",
  "bezier",
  "bounce",
  "data-binary",
  "data-vector2",
  "data-vector3",
  "graph-view",
  "key",
  "move-player-end-bounds",
  "move-playhead",
  "playback-0.1",
  "playback-0.5",
  "playback-1.0",
  "playback-1.5",
  "playback-2.0",
  "player-end-bounds",
  "rotate-3d",
  "time-display-frames",
  "time-display-milliseconds",
  "time-display-seconds",
  "time-display-seconds-frames",
  "time-display-ticks",
  "vector-angled",
  "vector-back",
  "vector-bezier",
  "vector-bezier-auto-clamp",
  "vector-bezier-handles",
  "vector-circ",
  "vector-cubic",
  "vector-expo",
  "vector-flat",
  "vector-linear",
  "vector-quad",
  "vector-quart",
  "vector-quint",
  "vector-sine",
  "vertex-free",
  "vertex-indeterminate",
  "vertex-paired",
  "vertical-normalize",
  "vertical-uniform",
] as const;

describe("editor icon ownership", () => {
  it("shares no key with ui's default registry", () => {
    expect(
      Object.keys(animationIconRegistry).filter((key) => Object.hasOwn(defaultIconRegistry, key)),
    ).toEqual([]);
  });

  it.each(editorGlyphKeys)("registers its %s glyph", (name) => {
    expect(Object.hasOwn(animationIconRegistry, name)).toBe(true);
  });

  it.each(Object.keys(animationIconRegistry) as AnimationIconName[])(
    "renders %s with only ui and editor registries",
    (name) => {
      const html = renderToStaticMarkup(
        <IconProvider
          registry={{ ...defaultIconRegistry, ...animationIconRegistry }}
          extend={false}
        >
          <Icon name={name} />
        </IconProvider>,
      );
      expect(html).toContain("<svg");
    },
  );
});
