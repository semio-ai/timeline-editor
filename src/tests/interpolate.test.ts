import { test, expect } from "vitest";
import { linearInterpolationGenerator } from "../interpolation/linear";
import { cubicInterpolationGenerator } from "../interpolation/cubic";

test("linear interpolation between 0 and 1 should be 0.5 at x=0.5", () => {
  const interpolator = linearInterpolationGenerator(0, 1);
  expect(interpolator(0.5)).toBe(0.5);
});

test("linear interpolation between true and false should return true at 0.25 and false at 0.75", () => {
  const interpolator = linearInterpolationGenerator(true, false);
  expect(interpolator(0.25)).toBe(true);
  expect(interpolator(0.75)).toBe(false);
});

test("linear interpolation between 'a' and 'b' should return 'a' at 0.25 and 'b' at 0.75", () => {
  const interpolator = linearInterpolationGenerator("a", "b");
  expect(interpolator(0.25)).toBe("a");
  expect(interpolator(0.75)).toBe("b");
});

test("linear interpolation between two vectors should return the correct interpolated vector", () => {
  const interpolator = linearInterpolationGenerator({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
  expect(interpolator(0.5)).toEqual({ x: 0.5, y: 0.5, z: 0.5 });
});

test("linear interpolation between two RGB colors should return the correct interpolated color", () => {
  const interpolator = linearInterpolationGenerator({ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 });
  expect(interpolator(0.5)).toEqual({ r: 127.5, g: 127.5, b: 0 });
});

test("linear interpolation between two HSL colors should return the correct interpolated color", () => {
  const interpolator = linearInterpolationGenerator(
    { h: 0, s: 100, l: 50 },
    { h: 120, s: 100, l: 50 },
  );
  expect(interpolator(0.5)).toEqual({ h: 60, s: 100, l: 50 });
});

test("linear interpolation between two Euler angles should return the correct interpolated angles", () => {
  const interpolator = linearInterpolationGenerator({ x: 0, y: 0, z: 0 }, { x: 90, y: 90, z: 90 });
  expect(interpolator(0.5)).toEqual({ x: 45, y: 45, z: 45 });
});

test("cubic interpolation between two numbers should return the correct value at t=0.5", () => {
  const interpolator = cubicInterpolationGenerator(0, 1, { x1: 0.25, x2: 0.75 });
  expect(interpolator(0.5)).toBe(0.5);
});

test("cubic interpolation between two strings should return the correct value at t=0.25 and t=0.75", () => {
  const interpolator = cubicInterpolationGenerator("a", "b", { x1: 0.25, x2: 0.75 });
  expect(interpolator(0.25)).toBe("a");
  expect(interpolator(0.75)).toBe("b");
});

test("cubic interpolation between two booleans should return the correct value at t=0.25 and t=0.75", () => {
  const interpolator = cubicInterpolationGenerator(true, false, { x1: 0.25, x2: 0.75 });
  expect(interpolator(0.25)).toBe(true);
  expect(interpolator(0.75)).toBe(false);
});

test("cubic interpolation between two vectors should return the correct interpolated vector", () => {
  const interpolator = cubicInterpolationGenerator(
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1, z: 1 },
    { x1: 0.25, x2: 0.75 },
  );
  expect(interpolator(0.5)).toEqual({ x: 0.5, y: 0.5, z: 0.5 });
});

test("cubic interpolation between two RGB colors should return the correct interpolated color", () => {
  const interpolator = cubicInterpolationGenerator(
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 255, b: 0 },
    { x1: 0.25, x2: 0.75 },
  );
  expect(interpolator(0.5)).toEqual({ r: 127.5, g: 127.5, b: 0 });
});
