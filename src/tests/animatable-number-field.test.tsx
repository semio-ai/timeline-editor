// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AnimatableNumber } from "@semio/data";
import { AnimatableNumberField } from "../components/animatable-number-field";

/**
 * The field converts in BOTH directions, and either half can break alone. A field
 * that showed 35 but handed back 35 would write a 35x value to a channel a robot
 * reads as a 0..1 fraction — a hand driven fully open — while looking right; one
 * that converted the value but not its limits would refuse anything above 1%.
 * So each case reads what is shown and what comes back out.
 */

const animatable = (units: string, min?: number, max?: number) =>
  ({
    id: "a",
    name: "Value",
    type: "number",
    default: 0,
    constraints: { min, max },
    pub: { public: true, output: "out", units },
  }) as unknown as AnimatableNumber;

function renderField(units: string, value: number, min?: number, max?: number) {
  const onChange = vi.fn();
  const view = render(
    <AnimatableNumberField
      animatable={animatable(units, min, max)}
      value={value}
      onChange={onChange}
    />,
  );
  const field = view.container.querySelector<HTMLInputElement>("input.grid-area-input-field");
  const suffix = view.container.querySelector<HTMLInputElement>("input.grid-area-input-units");
  if (!field) throw new Error("no value input");
  return { field, suffix, onChange };
}

/** Click into the field, as a person does before typing, then type `text`. */
function type(field: HTMLInputElement, text: string) {
  fireEvent.click(field);
  fireEvent.change(field, { target: { value: text } });
}

describe("AnimatableNumberField", () => {
  afterEach(cleanup);

  test("shows a stored fraction as a percentage and stores what is typed back as the fraction", () => {
    const { field, suffix, onChange } = renderField("%", 0.35, 0, 1);
    expect(Number(field.value)).toBeCloseTo(35);
    expect(suffix?.value).toBe("%");

    type(field, "50");
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.lastCall?.[0]).toBeCloseTo(0.5);
  });

  test("converts the limits too, so 35 sits 35% along a 0..100 slider", () => {
    // The slider's fill is the value's position between the limits; unconverted
    // limits (0..1) would pin a 35 at the end of the track.
    const { field, onChange } = renderField("%", 0.35, 0, 1);
    const track = field.closest<HTMLElement>("[style*='--progress']");
    expect(track?.style.getPropertyValue("--progress")).toBe("35.00%");

    type(field, "90");
    expect(onChange.mock.lastCall?.[0]).toBeCloseTo(0.9);
  });

  test("shows a stored angle in degrees and stores what is typed back in radians", () => {
    const { field, suffix, onChange } = renderField("rad", Math.PI / 2, -Math.PI, Math.PI);
    expect(Number(field.value)).toBeCloseTo(90);
    expect(suffix?.value).toBe("°");

    type(field, "45");
    expect(onChange.mock.lastCall?.[0]).toBeCloseTo(Math.PI / 4);
  });

  test("passes a value with an unconverted unit through both ways", () => {
    const { field, suffix, onChange } = renderField("m", 0.35);
    expect(Number(field.value)).toBeCloseTo(0.35);
    expect(suffix?.value).toBe("m");

    type(field, "0.5");
    expect(onChange.mock.lastCall?.[0]).toBeCloseTo(0.5);
  });

  test("shows no suffix for a dimensionless value", () => {
    const { suffix } = renderField("dimensionless", 0.25, 0, 1);
    expect(suffix).toBeNull();
  });
});
