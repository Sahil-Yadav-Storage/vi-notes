import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import type { Keystroke } from "@shared/keystroke";
import type { CloseSessionResponse } from "@shared/session";
import { keystrokeQueue } from "../offline/keystrokeQueue";
import {
  SessionContext,
  type SessionContextValue,
  type SessionStatus,
} from "./sessionContextStore";

type ActivePasteRange = {
  index: number;
  start: number;
  end: number;
};

type SessionProviderProps = {
  children: React.ReactNode;
  activeDocumentId: string;
  initialSessionId?: string | null;
};

const DEFAULT_SYNC_INTERVAL_MS = 5000;
const configuredSyncInterval = Number(
  import.meta.env.VITE_KEYSTROKE_SYNC_INTERVAL_MS ?? DEFAULT_SYNC_INTERVAL_MS,
);
const SYNC_INTERVAL_MS =
  Number.isFinite(configuredSyncInterval) && configuredSyncInterval > 0
    ? configuredSyncInterval
    : DEFAULT_SYNC_INTERVAL_MS;
const MAX_BUFFERED_EVENTS = 5000;
const MAX_PERSISTED_UNSYNCED_EVENTS = 20000;
const SYNC_BATCH_SIZE = 250;
const MAX_SYNC_RETRY_ATTEMPTS = 8;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 30000;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isClosedSessionError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeAxiosError = error as {
    response?: {
      status?: number;
      data?: {
        error?: unknown;
      };
    };
  };

  return (
    maybeAxiosError.response?.status === 400 &&
    maybeAxiosError.response?.data?.error === "Session is closed"
  );
};

const applyEditToActivePastes = (
  activePastes: ActivePasteRange[],
  changeStart: number,
  changeEnd: number,
  insertedLength: number,
  events: Keystroke[],
) => {
  const delta = insertedLength - (changeEnd - changeStart);
  const next: ActivePasteRange[] = [];

  for (const pasteRange of activePastes) {
    if (pasteRange.end <= changeStart) {
      next.push(pasteRange);
      continue;
    }

    if (pasteRange.start >= changeEnd) {
      next.push({
        ...pasteRange,
        start: pasteRange.start + delta,
        end: pasteRange.end + delta,
      });
      continue;
    }

    const pasteEvent = events[pasteRange.index];
    if (pasteEvent?.action === "paste") {
      pasteEvent.editedLater = true;
    }
  }

  return next;
};

const enrichPastesWithEditedLater = (events: Keystroke[]): Keystroke[] => {
  const enriched = events.map((event) => ({ ...event }));
  let activePastes: ActivePasteRange[] = [];

  for (let index = 0; index < enriched.length; index += 1) {
    const event = enriched[index];

    if (event.action === "edit") {
      if (
        isFiniteNumber(event.editStart) &&
        isFiniteNumber(event.editEnd) &&
        isFiniteNumber(event.insertedLength)
      ) {
        activePastes = applyEditToActivePastes(
          activePastes,
          event.editStart,
          event.editEnd,
          event.insertedLength,
          enriched,
        );
      }

      continue;
    }

    if (event.action === "paste") {
      if (
        isFiniteNumber(event.pasteSelectionStart) &&
        isFiniteNumber(event.pasteSelectionEnd) &&
        isFiniteNumber(event.pasteLength)
      ) {
        activePastes = applyEditToActivePastes(
          activePastes,
          event.pasteSelectionStart,
          event.pasteSelectionEnd,
          event.pasteLength,
          enriched,
        );

        activePastes.push({
          index,
          start: event.pasteSelectionStart,
          end: event.pasteSelectionStart + event.pasteLength,
        });
      }

      continue;
    }
  }

  return enriched;
};

const getChangeBounds = (before: string, after: string) => {
  const maxPrefix = Math.min(before.length, after.length);
  let prefix = 0;

  while (prefix < maxPrefix && before[prefix] === after[prefix]) {
    prefix += 1;
  }

  const maxSuffix = Math.min(before.length - prefix, after.length - prefix);
  let suffix = 0;

  while (
    suffix < maxSuffix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const removedLength = before.length - prefix - suffix;
  const insertedLength = after.length - prefix - suffix;

  if (removedLength === 0 && insertedLength === 0) {
    return null;
  }

  return {
    start: prefix,
    end: prefix + removedLength,
    insertedLength,
    removedLength,
  };
};

export const SessionProvider = ({
  children,
  activeDocumentId,
  initialSessionId = null,
}: SessionProviderProps) => {
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("idle");
  const [keystrokes, setKeystrokes] = useState<Keystroke[]>([]);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const downTimestamps = useRef<Map<string, number>>(new Map());
  const keystrokesRef = useRef<Keystroke[]>([]);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushPersistentQueueRef = useRef<() => Promise<void>>(async () => {});
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());
  const isSyncingRef = useRef(false);
  const retryAttemptsRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const pendingCloseRef = useRef(false);
  const isClosingRef = useRef(false);
  const hasClosedRef = useRef(false);
  const closeSessionRef = useRef<() => Promise<void>>(async () => {});

  const clearLastSyncError = useCallback(() => {
    setLastSyncError(null);
  }, []);

  const clearRetryTimer = useCallback(() => {
    if (!retryTimer.current) {
      return;
    }

    clearTimeout(retryTimer.current);
    retryTimer.current = null;
  }, []);

  const resetRetryState = useCallback(() => {
    retryAttemptsRef.current = 0;
    clearRetryTimer();
  }, [clearRetryTimer]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const dropBufferedKeystrokes = useCallback((count: number) => {
    if (count <= 0 || keystrokesRef.current.length === 0) {
      return;
    }

    keystrokesRef.current = keystrokesRef.current.slice(count);
    setKeystrokes(keystrokesRef.current);
  }, []);

  const persistKeystrokes = useCallback(
    (incoming: Keystroke[]) => {
      if (incoming.length === 0) {
        return;
      }

      if (!activeDocumentId) {
        setLastSyncError("No active file selected for sync.");
        return;
      }

      persistQueueRef.current = persistQueueRef.current
        .then(async () => {
          const dropped = await keystrokeQueue.enqueue(
            activeDocumentId,
            incoming,
            MAX_PERSISTED_UNSYNCED_EVENTS,
          );

          if (dropped > 0) {
            setLastSyncError(
              `Offline queue exceeded ${MAX_PERSISTED_UNSYNCED_EVENTS} events; dropped ${dropped} oldest persisted events.`,
            );
          }
        })
        .catch((error) => {
          console.error(error);
          setLastSyncError("Failed to persist keystrokes locally.");
        });
    },
    [activeDocumentId],
  );

  const pushKeystrokes = useCallback(
    (incoming: Keystroke[]) => {
      if (incoming.length === 0) {
        return;
      }

      const merged = [...keystrokesRef.current, ...incoming];

      if (merged.length > MAX_BUFFERED_EVENTS) {
        const droppedCount = merged.length - MAX_BUFFERED_EVENTS;
        keystrokesRef.current = merged.slice(droppedCount);
        setKeystrokes(keystrokesRef.current);
        setLastSyncError(
          `Active in-memory buffer exceeded ${MAX_BUFFERED_EVENTS} events; dropped ${droppedCount} oldest buffered events while persisted queue remains durable.`,
        );
      } else {
        keystrokesRef.current = merged;
        setKeystrokes(keystrokesRef.current);
      }

      persistKeystrokes(incoming);
    },
    [persistKeystrokes],
  );

  const clearKeystrokeBuffer = useCallback(() => {
    keystrokesRef.current = [];
    setKeystrokes([]);
  }, []);

  const ensureSession = useCallback(
    async (initialKeystrokes: Keystroke[]) => {
      if (sessionIdRef.current) return sessionIdRef.current;

      const payload = {
        documentId: activeDocumentId,
        keystrokes: initialKeystrokes,
      };

      const res = await api.post("/api/session", payload);
      const nextSessionId = res.data.sessionId as string;
      sessionIdRef.current = nextSessionId;
      setSessionId(nextSessionId);
      setSessionStatus("active");
      return nextSessionId;
    },
    [activeDocumentId],
  );

  const flushKeystrokes = useCallback((): Keystroke[] => {
    const pending = enrichPastesWithEditedLater(keystrokesRef.current);
    clearKeystrokeBuffer();
    return pending;
  }, [clearKeystrokeBuffer]);

  const scheduleRetry = useCallback(
    (attempt: number) => {
      const exponent = Math.max(0, attempt - 1);
      const delay = Math.min(
        RETRY_BASE_DELAY_MS * 2 ** exponent,
        RETRY_MAX_DELAY_MS,
      );

      clearRetryTimer();
      retryTimer.current = setTimeout(() => {
        retryTimer.current = null;
        void flushPersistentQueueRef.current();
      }, delay);

      setLastSyncError(
        `Failed to sync session (attempt ${attempt}/${MAX_SYNC_RETRY_ATTEMPTS}); retrying in ${Math.round(delay / 1000)}s.`,
      );
    },
    [clearRetryTimer],
  );

  const flushPersistentQueue = useCallback(async () => {
    if (isSyncingRef.current) {
      return;
    }

    if (hasClosedRef.current) {
      return;
    }

    await persistQueueRef.current;

    if (!navigator.onLine) {
      setLastSyncError("Offline: keystrokes are being buffered locally.");
      return;
    }

    isSyncingRef.current = true;

    try {
      while (true) {
        const pendingRecords = await keystrokeQueue.peekByDocument(
          activeDocumentId,
          SYNC_BATCH_SIZE,
        );
        if (pendingRecords.length === 0) {
          resetRetryState();
          return;
        }

        const pendingKeystrokes = enrichPastesWithEditedLater(
          pendingRecords.map((record) => record.event),
        );
        const queuedKeys = pendingRecords.map((record) => record.id);

        const activeSessionId = sessionIdRef.current;

        if (!activeSessionId) {
          const createdSessionId = await ensureSession(pendingKeystrokes);
          if (!createdSessionId) {
            return;
          }

          await keystrokeQueue.ackKeys(queuedKeys);
          dropBufferedKeystrokes(pendingKeystrokes.length);
          continue;
        }

        const payload = {
          keystrokes: pendingKeystrokes,
        };

        try {
          await api.patch(`/api/session/${activeSessionId}`, payload);
        } catch (error) {
          if (isClosedSessionError(error)) {
            sessionIdRef.current = null;
            setSessionId(null);
            setSessionStatus("idle");
            setLastSyncError(
              "Detected a closed session during sync; continuing in a new session.",
            );
            continue;
          }

          throw error;
        }

        await keystrokeQueue.ackKeys(queuedKeys);
        dropBufferedKeystrokes(pendingKeystrokes.length);
        resetRetryState();
      }
    } catch (err) {
      console.error(err);

      retryAttemptsRef.current += 1;
      const attempt = retryAttemptsRef.current;

      if (attempt > MAX_SYNC_RETRY_ATTEMPTS) {
        resetRetryState();
        setLastSyncError(
          `Failed to sync session after ${MAX_SYNC_RETRY_ATTEMPTS} retries; unsynced events are still safely persisted and will retry when sync resumes.`,
        );
        return;
      }

      scheduleRetry(attempt);
    } finally {
      isSyncingRef.current = false;
    }
  }, [
    activeDocumentId,
    dropBufferedKeystrokes,
    ensureSession,
    resetRetryState,
    scheduleRetry,
  ]);

  useEffect(() => {
    flushPersistentQueueRef.current = flushPersistentQueue;
  }, [flushPersistentQueue]);

  const flushAndSync = useCallback(async () => {
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
      syncTimer.current = null;
    }

    await flushPersistentQueue();
  }, [flushPersistentQueue]);

  const closeCurrentSession = useCallback(async () => {
    if (isClosingRef.current || hasClosedRef.current) {
      return;
    }

    isClosingRef.current = true;
    setSessionStatus("closing");
    clearRetryTimer();

    try {
      await flushAndSync();

      const pendingPersisted = await keystrokeQueue.peekByDocument(
        activeDocumentId,
        1,
      );

      if (pendingPersisted.length > 0) {
        pendingCloseRef.current = true;
        setLastSyncError(
          "Session close deferred because unsynced events remain buffered locally.",
        );
        setSessionStatus(sessionIdRef.current ? "active" : "idle");
        return;
      }

      if (!sessionIdRef.current) {
        pendingCloseRef.current = false;
        hasClosedRef.current = true;
        setSessionStatus("closed");
        return;
      }

      const response = await api.post<CloseSessionResponse>(
        `/api/session/${sessionIdRef.current}/close`,
      );

      if (response.status === 200) {
        pendingCloseRef.current = false;
        hasClosedRef.current = true;
        sessionIdRef.current = null;
        setSessionId(null);
        setSessionStatus("closed");
      }
    } catch (err) {
      console.error(err);
      setLastSyncError("Failed to close session.");
      setSessionStatus(sessionIdRef.current ? "active" : "idle");
    } finally {
      isClosingRef.current = false;
    }
  }, [activeDocumentId, clearRetryTimer, flushAndSync]);

  useEffect(() => {
    closeSessionRef.current = closeCurrentSession;
  }, [closeCurrentSession]);

  const scheduleSync = useCallback(() => {
    if (sessionStatus === "closing" || sessionStatus === "closed") {
      return;
    }

    if (retryTimer.current) {
      return;
    }

    if (syncTimer.current) clearTimeout(syncTimer.current);

    syncTimer.current = setTimeout(() => {
      syncTimer.current = null;
      void flushPersistentQueue();
    }, SYNC_INTERVAL_MS);
  }, [flushPersistentQueue, sessionStatus]);

  useEffect(() => {
    sessionIdRef.current = initialSessionId;
    setSessionId(initialSessionId);
    hasClosedRef.current = false;
    pendingCloseRef.current = false;
    setSessionStatus(initialSessionId ? "active" : "idle");
  }, [initialSessionId]);

  useEffect(() => {
    let isCancelled = false;

    const hydrateBufferedKeystrokes = async () => {
      try {
        await persistQueueRef.current;
        const pendingRecords = await keystrokeQueue.peekByDocument(
          activeDocumentId,
          MAX_BUFFERED_EVENTS,
        );

        if (isCancelled || pendingRecords.length === 0) {
          return;
        }

        const pending = pendingRecords.map((record) => record.event);
        keystrokesRef.current = pending;
        setKeystrokes(pending);
        scheduleSync();
      } catch (error) {
        console.error(error);
        setLastSyncError(
          "Failed to load buffered keystrokes from local storage.",
        );
      }
    };

    void hydrateBufferedKeystrokes();

    return () => {
      isCancelled = true;
    };
  }, [activeDocumentId, scheduleSync]);

  useEffect(() => {
    const handlePageHide = () => {
      void closeSessionRef.current();
    };

    const handleOnline = () => {
      void (async () => {
        await flushPersistentQueueRef.current();

        if (!pendingCloseRef.current) {
          return;
        }

        const pendingPersisted = await keystrokeQueue.peekByDocument(
          activeDocumentId,
          1,
        );
        if (pendingPersisted.length > 0) {
          return;
        }

        await closeSessionRef.current();
      })();
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("online", handleOnline);

    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      clearRetryTimer();
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("online", handleOnline);
      void closeSessionRef.current();
    };
  }, [activeDocumentId, clearRetryTimer]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const now = Date.now();
      downTimestamps.current.set(e.code, now);

      pushKeystrokes([{ action: "down", timestamp: now }]);
      scheduleSync();
    },
    [pushKeystrokes, scheduleSync],
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      const now = Date.now();
      const downAt = downTimestamps.current.get(e.code);
      downTimestamps.current.delete(e.code);

      const duration = downAt !== undefined ? now - downAt : undefined;

      pushKeystrokes([
        {
          action: "up",
          timestamp: now,
          ...(duration !== undefined && { duration }),
        },
      ]);
      scheduleSync();
    },
    [pushKeystrokes, scheduleSync],
  );

  const logPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pasteLength = e.clipboardData.getData("text").length;
      const selectionStart = e.currentTarget.selectionStart;
      const selectionEnd = e.currentTarget.selectionEnd;
      const timestamp = Date.now();

      pushKeystrokes([
        {
          action: "paste",
          timestamp,
          pasteLength,
          pasteSelectionStart: selectionStart,
          pasteSelectionEnd: selectionEnd,
        },
      ]);
      scheduleSync();
    },
    [pushKeystrokes, scheduleSync],
  );

  const logTextChange = useCallback(
    (before: string, after: string) => {
      const change = getChangeBounds(before, after);
      if (!change) {
        return;
      }

      pushKeystrokes([
        {
          action: "edit",
          timestamp: Date.now(),
          editStart: change.start,
          editEnd: change.end,
          insertedLength: change.insertedLength,
          removedLength: change.removedLength,
        },
      ]);
      scheduleSync();
    },
    [pushKeystrokes, scheduleSync],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      sessionId,
      sessionStatus,
      keystrokes,
      lastSyncError,
      clearLastSyncError,
      handleKeyDown,
      handleKeyUp,
      logPaste,
      logTextChange,
      flushKeystrokes,
      scheduleSync,
    }),
    [
      clearLastSyncError,
      flushKeystrokes,
      handleKeyDown,
      handleKeyUp,
      keystrokes,
      lastSyncError,
      logPaste,
      logTextChange,
      scheduleSync,
      sessionId,
      sessionStatus,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};
