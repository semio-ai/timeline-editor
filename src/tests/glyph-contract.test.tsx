import { renderToStaticMarkup } from "react-dom/server";
import { Icon, IconProvider } from "@semio/ui";
import { describe, expect, it } from "vitest";
import { animationIconRegistry } from "../icons/registry";

const propContracts = {
  width: (html: string) => expect(html).toContain('width="18px"'),
  class: (html: string) => expect(html).toContain('class="'),
  callerClass: (html: string) => expect(html).toContain("caller-icon"),
  accessibility: (html: string) => expect(html).toContain('aria-label="Example"'),
  title: (html: string) => expect(html).toContain("<title>Accessible glyph</title>"),
  color: (html: string) => expect(html).toContain("rebeccapurple"),
  mirroring: (html: string) => expect(html).toContain('transform="scale(-1, 1)"'),
  callerStyle: (html: string) => expect(html).toContain("opacity:0.7"),
  mirroredProp: (html: string) => expect(html).not.toContain('mirrored="'),
  altProp: (html: string) => expect(html).not.toContain('alt="'),
};

// Each contract runs separately so a failure cannot hide another prop regression.
describe.each([
  "vector-bezier",
  "vector-sine",
  "graph-view",
  "vertical-uniform",
  "vertical-normalize",
  "vertex-free",
  "vertex-paired",
  "vertex-indeterminate",
  "bezier",
  "rotate-3d",
  "time-display-milliseconds",
  "time-display-seconds",
  "time-display-frames",
  "time-display-seconds-frames",
  "time-display-ticks",
] as const)("%s glyph props through the registry", (name) => {
  it.each(Object.entries(propContracts))("forwards %s", (_contract, check) => {
    const html = renderToStaticMarkup(
      <IconProvider registry={animationIconRegistry}>
        <Icon
          name={name}
          size="none"
          className="caller-icon"
          color="rebeccapurple"
          alt="Accessible glyph"
          aria-label="Example"
          mirrored
          style={{ opacity: 0.7 }}
        />
      </IconProvider>,
    );
    check(html);
  });
});

describe("state-controlled glyph opacity", () => {
  it("preserves the keyframe fill opacity", () => {
    const html = renderToStaticMarkup(
      <IconProvider registry={animationIconRegistry}>
        <Icon name="key" fillOpacity={0.5} />
      </IconProvider>,
    );
    expect(html).toContain('fill-opacity="0.5"');
  });
});
