import { describe, it, expect } from "vitest";
import { classifyLuma } from "../lighting";

describe("classifyLuma", () => {
  it("flags dark and overexposed faces, passes normal ones", () => {
    expect(classifyLuma(20)).toBe("too_dark");
    expect(classifyLuma(240)).toBe("too_bright");
    expect(classifyLuma(120)).toBeNull();
  });
});