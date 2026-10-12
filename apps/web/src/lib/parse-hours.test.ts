import { describe, expect, it } from "vite-plus/test";

import { hoursToRange, parseHours } from "./parse-hours";

describe("parseHours", () => {
  it("treats blank input as no time logged", () => {
    expect(parseHours("")).toEqual({ status: "empty" });
    expect(parseHours("   ")).toEqual({ status: "empty" });
  });

  it("accepts integers, dot decimals and comma decimals", () => {
    expect(parseHours("2")).toEqual({ status: "ok", hours: 2 });
    expect(parseHours("1.5")).toEqual({ status: "ok", hours: 1.5 });
    expect(parseHours(" 1,5 ")).toEqual({ status: "ok", hours: 1.5 });
    expect(parseHours("0,25")).toEqual({ status: "ok", hours: 0.25 });
  });

  it.each(["abc", "-1", "0", "0,0", "1,5,2", "1h", "1000.5", "1e3", ","])(
    "rejects %s",
    (raw) => {
      expect(parseHours(raw)).toEqual({ status: "invalid" });
    },
  );
});

describe("hoursToRange", () => {
  it("ends at now and starts the given hours earlier", () => {
    const now = new Date("2026-10-12T12:00:00.000Z");
    expect(hoursToRange(1.5, now)).toEqual({
      startTime: "2026-10-12T10:30:00.000Z",
      endTime: "2026-10-12T12:00:00.000Z",
    });
  });
});
