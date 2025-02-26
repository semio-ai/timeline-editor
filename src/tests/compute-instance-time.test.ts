import { test, expect } from "vitest";
import { computeLocalStamp, computeWorldStamp } from "../functions/compute-instance-time";

const defaultInstance = { offset: 0, timescale: 1 };
const doubleSpeedInstance = { offset: 0, timescale: 2 };
const offsetInstance = { offset: 0.5, timescale: 1 };
const offsetDoubleSpeedInstance = { offset: 0.5, timescale: 2 };

test("Local Timestamp to World Timestamp Conversion", () => {
  expect(computeWorldStamp(0, defaultInstance.timescale, defaultInstance.offset)).toBe(0);
  expect(computeWorldStamp(0, doubleSpeedInstance.timescale, doubleSpeedInstance.offset)).toBe(0);
  expect(computeWorldStamp(0, offsetInstance.timescale, offsetInstance.offset)).toBe(0.5);
  expect(
    computeWorldStamp(0, offsetDoubleSpeedInstance.timescale, offsetDoubleSpeedInstance.offset),
  ).toBe(0.5);

  expect(computeWorldStamp(0.5, defaultInstance.timescale, defaultInstance.offset)).toBe(0.5);
  expect(computeWorldStamp(0.5, doubleSpeedInstance.timescale, doubleSpeedInstance.offset)).toBe(
    0.25,
  );
  expect(computeWorldStamp(0.5, offsetInstance.timescale, offsetInstance.offset)).toBe(1);
  expect(
    computeWorldStamp(0.5, offsetDoubleSpeedInstance.timescale, offsetDoubleSpeedInstance.offset),
  ).toBe(0.75);

  expect(computeWorldStamp(1, defaultInstance.timescale, defaultInstance.offset)).toBe(1);
  expect(computeWorldStamp(1, doubleSpeedInstance.timescale, doubleSpeedInstance.offset)).toBe(0.5);
  expect(computeWorldStamp(1, offsetInstance.timescale, offsetInstance.offset)).toBe(1.5);
  expect(
    computeWorldStamp(1, offsetDoubleSpeedInstance.timescale, offsetDoubleSpeedInstance.offset),
  ).toBe(1);
});

test("World Timestamp to Local Timestamp Conversion", () => {
  expect(computeLocalStamp(0, defaultInstance.timescale, defaultInstance.offset)).toBe(0);
  expect(computeLocalStamp(0, doubleSpeedInstance.timescale, doubleSpeedInstance.offset)).toBe(0);
  expect(computeLocalStamp(0.5, offsetInstance.timescale, offsetInstance.offset)).toBe(0);
  expect(
    computeLocalStamp(0.5, offsetDoubleSpeedInstance.timescale, offsetDoubleSpeedInstance.offset),
  ).toBe(0);

  expect(computeLocalStamp(0.5, defaultInstance.timescale, defaultInstance.offset)).toBe(0.5);
  expect(computeLocalStamp(0.5, doubleSpeedInstance.timescale, doubleSpeedInstance.offset)).toBe(1);
  expect(computeLocalStamp(0.5, offsetInstance.timescale, offsetInstance.offset)).toBe(0);
  expect(
    computeLocalStamp(0.5, offsetDoubleSpeedInstance.timescale, offsetDoubleSpeedInstance.offset),
  ).toBe(0);

  expect(computeLocalStamp(1, defaultInstance.timescale, defaultInstance.offset)).toBe(1);
  expect(computeLocalStamp(1, doubleSpeedInstance.timescale, doubleSpeedInstance.offset)).toBe(2);
  expect(computeLocalStamp(1, offsetInstance.timescale, offsetInstance.offset)).toBe(0.5);
  expect(
    computeLocalStamp(1, offsetDoubleSpeedInstance.timescale, offsetDoubleSpeedInstance.offset),
  ).toBe(1);
});
