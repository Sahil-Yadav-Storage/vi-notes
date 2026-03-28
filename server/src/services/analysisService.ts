import type { Keystroke, SessionAnalytics } from "@shared/index";

const CHARS_PER_WORD = 5;
const WPM_WINDOW_MS = 60_000;
const PAUSE_THRESHOLD_MS = 2_000;
const ANALYTICS_VERSION = 1;

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const getNumericValue = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const getPreferredTimestamp = (event: Keystroke): number | undefined => {
  if (typeof event.timestamp === "number" && Number.isFinite(event.timestamp)) {
    return event.timestamp;
  }

  if (
    typeof event.rawTimestamp === "number" &&
    Number.isFinite(event.rawTimestamp)
  ) {
    return event.rawTimestamp;
  }

  return undefined;
};

const getPreferredDuration = (event: Keystroke): number | undefined => {
  if (typeof event.duration === "number" && Number.isFinite(event.duration)) {
    return event.duration;
  }

  if (
    typeof event.rawDuration === "number" &&
    Number.isFinite(event.rawDuration)
  ) {
    return event.rawDuration;
  }

  return undefined;
};

const getVariance = (values: number[]) => {
  if (values.length <= 1) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const squaredDiff = values.map((value) => (value - mean) ** 2);

  return squaredDiff.reduce((sum, value) => sum + value, 0) / values.length;
};

const getSortedEvents = (keystrokes: Keystroke[]) =>
  [...keystrokes].sort(
    (a, b) => (getPreferredTimestamp(a) ?? 0) - (getPreferredTimestamp(b) ?? 0),
  );

export const computeSessionAnalytics = (
  keystrokes: Keystroke[],
): SessionAnalytics => {
  if (!Array.isArray(keystrokes) || keystrokes.length === 0) {
    return {
      version: ANALYTICS_VERSION,
      approximateWpmVariance: 0,
      pauseFrequency: 0,
      editRatio: 0,
      pasteRatio: 0,
      totalInsertedChars: 0,
      totalDeletedChars: 0,
      finalChars: 0,
      totalPastedChars: 0,
      pauseCount: 0,
      durationMs: 0,
    };
  }

  const orderedEvents = getSortedEvents(keystrokes);
  const firstEvent = orderedEvents[0];
  const lastEvent = orderedEvents[orderedEvents.length - 1];
  const firstTimestamp = firstEvent
    ? (getPreferredTimestamp(firstEvent) ?? 0)
    : 0;
  const lastTimestamp = lastEvent
    ? (getPreferredTimestamp(lastEvent) ?? firstTimestamp)
    : firstTimestamp;
  const durationMs = Math.max(0, lastTimestamp - firstTimestamp);

  let totalInsertedChars = 0;
  let totalDeletedChars = 0;
  let totalPastedChars = 0;

  const totalWindows = Math.max(1, Math.floor(durationMs / WPM_WINDOW_MS) + 1);
  const wpmBuckets = Array.from({ length: totalWindows }, () => 0);

  for (const event of orderedEvents) {
    if (event.action === "edit") {
      const inserted = getNumericValue(event.insertedLength);
      const removed = getNumericValue(event.removedLength);

      totalInsertedChars += inserted;
      totalDeletedChars += removed;

      const windowIndex = Math.min(
        totalWindows - 1,
        Math.max(
          0,
          Math.floor(
            ((getPreferredTimestamp(event) ?? firstTimestamp) -
              firstTimestamp) /
              WPM_WINDOW_MS,
          ),
        ),
      );
      const bucketValue = wpmBuckets[windowIndex] ?? 0;
      wpmBuckets[windowIndex] = bucketValue + inserted / CHARS_PER_WORD;
    }

    if (event.action === "paste") {
      totalPastedChars += getNumericValue(event.pasteLength);
    }
  }

  let pauseCount = 0;
  for (let index = 1; index < orderedEvents.length; index += 1) {
    const currentEvent = orderedEvents[index];
    const previousEvent = orderedEvents[index - 1];

    if (!currentEvent || !previousEvent) {
      continue;
    }

    const currentTimestamp = getPreferredTimestamp(currentEvent);
    const previousTimestamp = getPreferredTimestamp(previousEvent);
    const gap =
      typeof currentTimestamp === "number" &&
      typeof previousTimestamp === "number"
        ? currentTimestamp - previousTimestamp
        : (getPreferredDuration(currentEvent) ??
          getPreferredDuration(previousEvent) ??
          0);
    if (gap >= PAUSE_THRESHOLD_MS) {
      pauseCount += 1;
    }
  }

  const finalChars = Math.max(totalInsertedChars - totalDeletedChars, 0);
  const totalProducedChars = Math.max(totalInsertedChars, 0);
  const editRatio = finalChars > 0 ? totalDeletedChars / finalChars : 0;
  const pasteRatio =
    totalProducedChars > 0 ? totalPastedChars / totalProducedChars : 0;
  const pauseFrequency =
    durationMs > 0 ? pauseCount / (durationMs / WPM_WINDOW_MS) : 0;

  return {
    version: ANALYTICS_VERSION,
    approximateWpmVariance: roundTo(getVariance(wpmBuckets), 4),
    pauseFrequency: roundTo(pauseFrequency, 4),
    editRatio: roundTo(editRatio, 4),
    pasteRatio: roundTo(pasteRatio, 4),
    totalInsertedChars,
    totalDeletedChars,
    finalChars,
    totalPastedChars,
    pauseCount,
    durationMs,
  };
};
