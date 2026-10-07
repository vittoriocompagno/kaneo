import { describe, expect, it } from "vite-plus/test";
import { formatTrackedTime } from "./format-tracked-time";

describe("formatTrackedTime", () => {
  it.each([
    [0, "0m"],
    [29, "0m"],
    [30, "1m"],
    [3600, "1h"],
    [5400, "1h 30m"],
    [10900, "3h 2m"],
    [360000, "100h"],
    [-5, "0m"],
  ])("%i seconds -> %s", (seconds, expected) => {
    expect(formatTrackedTime(seconds)).toBe(expected);
  });
});
