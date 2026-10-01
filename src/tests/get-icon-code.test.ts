import { describe, expect, test } from "vitest";
import { getIconCode } from "../functions/get-icon-code";

describe("getIconCode", () => {
  test("gives every spelling of a unit that unit's icon", () => {
    expect(getIconCode("number", "percentage")).toBe("%");
    expect(getIconCode("number", "radians")).toBe("rad");
    expect(getIconCode("number", undefined)).toBe("none");
    expect(getIconCode("number", "dimensionless")).toBe("none");
    expect(getIconCode("number", "intensity")).toBe("intensity");
  });
});
