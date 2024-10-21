import { test, expect } from "vitest";
import { computeLocalStamp, computeWorldStamp } from "../functions/compute-instance-time";

const defaultInstance = { offset: 0, timescale: 1 };
const doubleSpeedInstance = { offset: 0, timescale: 2 };
const offsetInstance = { offset: 0.5, timescale: 1 };
const offsetDoubleSpeedInstance = { offset: 0.5, timescale: 2 };

test("Local Timestamp to World Timestamp Conversion", () => {
  expect(computeWorldStamp(0, defaultInstance)).toBe(0);
  expect(computeWorldStamp(0, doubleSpeedInstance)).toBe(0);
  expect(computeWorldStamp(0, offsetInstance)).toBe(0.5);
  expect(computeWorldStamp(0, offsetDoubleSpeedInstance)).toBe(0.5);

  expect(computeWorldStamp(0.5, defaultInstance)).toBe(0.5);
  expect(computeWorldStamp(0.5, doubleSpeedInstance)).toBe(0.25);
  expect(computeWorldStamp(0.5, offsetInstance)).toBe(1);
  expect(computeWorldStamp(0.5, offsetDoubleSpeedInstance)).toBe(0.75);

  expect(computeWorldStamp(1, defaultInstance)).toBe(1);
  expect(computeWorldStamp(1, doubleSpeedInstance)).toBe(0.5);
  expect(computeWorldStamp(1, offsetInstance)).toBe(1.5);
  expect(computeWorldStamp(1, offsetDoubleSpeedInstance)).toBe(1);
});

test("World Timestamp to Local Timestamp Conversion", () => {
  expect(computeLocalStamp(0, defaultInstance)).toBe(0);
  expect(computeLocalStamp(0, doubleSpeedInstance)).toBe(0);
  expect(computeLocalStamp(0.5, offsetInstance)).toBe(0);
  expect(computeLocalStamp(0.5, offsetDoubleSpeedInstance)).toBe(0);

  expect(computeLocalStamp(0.5, defaultInstance)).toBe(0.5);
  expect(computeLocalStamp(0.5, doubleSpeedInstance)).toBe(1);
  expect(computeLocalStamp(0.5, offsetInstance)).toBe(0);
  expect(computeLocalStamp(0.5, offsetDoubleSpeedInstance)).toBe(0);

  expect(computeLocalStamp(1, defaultInstance)).toBe(1);
  expect(computeLocalStamp(1, doubleSpeedInstance)).toBe(2);
  expect(computeLocalStamp(1, offsetInstance)).toBe(0.5);
  expect(computeLocalStamp(1, offsetDoubleSpeedInstance)).toBe(1);
});
