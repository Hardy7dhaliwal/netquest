import { describe, expect, it } from "vitest";
import { currentRun, longestRun } from "./streak";

describe("longestRun", () => {
  it("is zero with no claimed days", () => {
    expect(longestRun([])).toBe(0);
  });

  it("counts a single day as a run of one", () => {
    expect(longestRun(["2026-08-12"])).toBe(1);
  });

  it("counts consecutive days", () => {
    expect(longestRun(["2026-08-10", "2026-08-11", "2026-08-12"])).toBe(3);
  });

  it("returns the longest run when a gap breaks the chain", () => {
    expect(longestRun(["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-05", "2026-08-06"])).toBe(3);
  });

  it("ignores duplicates and out-of-order input", () => {
    expect(longestRun(["2026-08-12", "2026-08-10", "2026-08-11", "2026-08-11"])).toBe(3);
  });

  it("crosses month boundaries", () => {
    expect(longestRun(["2026-07-30", "2026-07-31", "2026-08-01"])).toBe(3);
  });
});

describe("currentRun", () => {
  const noon = () => new Date(2026, 7, 13, 12); // 2026-08-13

  it("counts back from today when today is claimed", () => {
    expect(currentRun(["2026-08-13", "2026-08-12", "2026-08-11"], noon())).toBe(3);
  });

  it("keeps the chain alive when today is still claimable", () => {
    expect(currentRun(["2026-08-12", "2026-08-11"], noon())).toBe(2);
  });

  it("is zero when the chain already broke today", () => {
    expect(currentRun(["2026-08-10", "2026-08-09"], noon())).toBe(0);
  });

  it("is zero with no history", () => {
    expect(currentRun([], noon())).toBe(0);
  });
});
