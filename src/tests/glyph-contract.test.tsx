// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { Icon, IconProvider } from "@semio/ui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IconHandleIndicator } from "../icons/handle-indicator";
import type { IconKeyProps } from "../icons/key";
import { animationIconRegistry } from "../icons/registry";

afterEach(cleanup);

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

describe.each(["key", "circle", "diamond", "indeterminate"] as const)(
  "%s custom glyph contract",
  (name) => {
    function renderGlyph(props: IconKeyProps = {}) {
      if (name === "key") {
        return render(
          <IconProvider registry={animationIconRegistry}>
            <Icon {...props} name="key" size="none" />
          </IconProvider>,
        ).container.querySelector("svg")!;
      }
      return render(<IconHandleIndicator {...props} handle={name} />).container.querySelector(
        "svg",
      )!;
    }

    const contracts = {
      accessibility: (svg: SVGSVGElement) => expect(svg.getAttribute("aria-label")).toBe("Example"),
      ariaHidden: (svg: SVGSVGElement) => expect(svg.getAttribute("aria-hidden")).toBe("false"),
      role: (svg: SVGSVGElement) => expect(svg.getAttribute("role")).toBe("img"),
      nativeAttribute: (svg: SVGSVGElement) => expect(svg.getAttribute("tabindex")).toBe("0"),
      dataAttribute: (svg: SVGSVGElement) => expect(svg.getAttribute("data-glyph")).toBe("example"),
      title: (svg: SVGSVGElement) =>
        expect(svg.querySelector("title")?.textContent).toBe("Accessible glyph"),
      mirroring: (svg: SVGSVGElement) => expect(svg.getAttribute("transform")).toBe("scale(-1, 1)"),
      defaultClass: (svg: SVGSVGElement) =>
        expect(svg.getAttribute("class")).toContain("icon icon-tabler"),
      callerClass: (svg: SVGSVGElement) => expect(svg.classList.contains("caller-icon")).toBe(true),
      callerStyle: (svg: SVGSVGElement) => expect(svg.style.opacity).toBe("0.7"),
      styleOverride: (svg: SVGSVGElement) => expect(svg.style.strokeLinecap).toBe("butt"),
      defaultSize: (svg: SVGSVGElement) => expect(svg.getAttribute("width")).toBe("24"),
      color: (svg: SVGSVGElement) =>
        expect(svg.querySelector("path")?.getAttribute(name === "key" ? "fill" : "stroke")).toBe(
          "rebeccapurple",
        ),
    };

    it.each(Object.entries(contracts))("forwards %s", (_contract, check) => {
      check(
        renderGlyph({
          "aria-label": "Example",
          "aria-hidden": false,
          role: "img",
          tabIndex: 0,
          ...{ "data-glyph": "example" },
          alt: "Accessible glyph",
          title: "Fallback title",
          mirrored: true,
          className: "caller-icon",
          color: "rebeccapurple",
          style: { opacity: 0.7, strokeLinecap: "butt" },
        }),
      );
    });

    it("forwards event handlers", () => {
      const onClick = vi.fn();
      fireEvent.click(renderGlyph({ onClick }));
      expect(onClick).toHaveBeenCalledOnce();
    });

    it("uses title when alt is absent", () => {
      expect(renderGlyph({ title: "Fallback title" }).querySelector("title")?.textContent).toBe(
        "Fallback title",
      );
    });

    it("keeps an empty alt silent", () => {
      expect(renderGlyph({ alt: "", title: "Fallback title" }).querySelector("title")).toBeNull();
    });

    const ownAttributes = ["size", "color", "title", "alt", "mirrored", "fill-opacity"];
    if (name === "key") ownAttributes.push("dashed", "center");
    else ownAttributes.push("stroke", "handle");

    it.each(ownAttributes)("consumes %s", (attribute) => {
      const options: IconKeyProps = {
        stroke: 4,
        title: "Title",
        alt: "Alt",
        mirrored: true,
        color: "red",
        fillOpacity: 0.5,
      };
      if (name === "key") {
        options.dashed = true;
        options.center = "plus";
      } else {
        options.size = 30;
      }
      expect(renderGlyph(options).hasAttribute(attribute)).toBe(false);
    });

    if (name === "key") {
      it("maps the stroke option to stroke width", () => {
        expect(renderGlyph({ stroke: 4 }).getAttribute("stroke-width")).toBe("4");
      });

      it("uses color for the root stroke", () => {
        expect(renderGlyph({ stroke: 4, color: "red" }).getAttribute("stroke")).toBe("red");
      });
    } else {
      it("preserves unmodified default styles", () => {
        expect(renderGlyph({ style: { opacity: 0.7 } }).style.fillRule).toBe("evenodd");
      });
    }
  },
);
