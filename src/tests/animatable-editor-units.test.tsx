// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AnimatableValue } from "@semio/utils";
import { AnimatableEditor } from "../components/animatable-editor";
import { AnimationContext } from "../context";
import { createAnimationStore } from "../store";
import type { SourceRowData, Track } from "../types";

/**
 * The timeline row's editor converts between stored and displayed values itself,
 * beside its own drag pipeline, so it is pinned separately from
 * `AnimatableNumberField`: shown in display units, handed back in stored ones.
 */

function renderEditor(units: string, stored: number, min: number, max: number) {
  const animatable = {
    id: "a",
    name: "Value",
    type: "number",
    default: stored,
    constraints: { min, max },
    pub: { public: true, output: "out", units },
  } as unknown as AnimatableValue;
  const track = {
    id: "t",
    name: "Track",
    animatableId: "a",
    points: [],
  } as unknown as Track<number>;
  const store = createAnimationStore({ animatables: { a: animatable }, tracks: { t: track } });
  const data = {
    editable: true,
    selectable: true,
    animationId: "anim",
    namespaceId: "ns",
    instanceId: "inst",
    type: "number",
    trackId: "t",
    animatableId: "a",
  } as unknown as SourceRowData;
  const handleValueChange = vi.fn();
  const view = render(
    <AnimationContext.Provider value={store}>
      <AnimatableEditor
        rowId="row"
        data={data}
        playing={false}
        handleValueChange={handleValueChange}
        hideLabel
      />
    </AnimationContext.Provider>,
  );
  const field = view.container.querySelector<HTMLInputElement>("input.grid-area-input-field");
  const suffix = view.container.querySelector<HTMLInputElement>("input.grid-area-input-units");
  if (!field) throw new Error("no value input");
  return { field, suffix, handleValueChange };
}

function type(field: HTMLInputElement, text: string) {
  fireEvent.click(field);
  fireEvent.change(field, { target: { value: text } });
}

describe("AnimatableEditor units", () => {
  afterEach(cleanup);

  test("shows a stored fraction as a percentage and hands back the fraction", () => {
    const { field, suffix, handleValueChange } = renderEditor("percentage", 0.35, 0, 1);
    expect(Number(field.value)).toBeCloseTo(35);
    expect(suffix?.value).toBe("%");
    expect(
      field.closest<HTMLElement>("[style*='--progress']")?.style.getPropertyValue("--progress"),
    ).toBe("35.00%");

    type(field, "50");
    expect(handleValueChange.mock.lastCall?.[0]).toBeCloseTo(0.5);
  });

  test("shows a stored angle in degrees and hands back radians", () => {
    const { field, suffix, handleValueChange } = renderEditor(
      "radians",
      Math.PI / 2,
      -Math.PI,
      Math.PI,
    );
    expect(Number(field.value)).toBeCloseTo(90);
    expect(suffix?.value).toBe("°");

    type(field, "45");
    expect(handleValueChange.mock.lastCall?.[0]).toBeCloseTo(Math.PI / 4);
  });
});
