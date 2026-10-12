const MAX_HOURS = 1000;

export type ParsedHours =
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "ok"; hours: number };

// Accepts "2", "1.5" and "1,5" (Italian decimal comma). Empty means "no time logged".
export function parseHours(raw: string): ParsedHours {
  const value = raw.trim().replace(",", ".");
  if (value === "") return { status: "empty" };
  if (!/^\d+(\.\d+)?$/.test(value)) return { status: "invalid" };

  const hours = Number(value);
  // Whole seconds are the API's resolution, so anything below 1 s is zero.
  if (!Number.isFinite(hours) || hours * 3600 < 1 || hours > MAX_HOURS) {
    return { status: "invalid" };
  }
  return { status: "ok", hours };
}

// A finished entry that ended at `now` and lasted `hours`.
export function hoursToRange(hours: number, now: Date = new Date()) {
  const seconds = Math.round(hours * 3600);
  return {
    startTime: new Date(now.getTime() - seconds * 1000).toISOString(),
    endTime: now.toISOString(),
  };
}

// Estimates are stored as whole minutes; never round a real estimate down to 0.
export function hoursToMinutes(hours: number) {
  return Math.max(1, Math.round(hours * 60));
}

export function minutesToHoursInput(minutes: number) {
  return String(Math.round((minutes / 60) * 100) / 100).replace(".", ",");
}
